import { expect, test, type Page } from "@playwright/test";

async function assertLayout(page: Page) {
  const geometry = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>(".app-navigation")!;
    const rect = nav.getBoundingClientRect();
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("a,button,input,select"),
    ).filter((element) => element.checkVisibility());
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      nav: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      },
      targets: targets.map((element) => ({
        name: element.getAttribute("aria-label") || element.textContent?.trim(),
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })),
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
  expect(geometry.nav.left).toBeGreaterThanOrEqual(0);
  expect(geometry.nav.right).toBeLessThanOrEqual(geometry.width);
  for (const target of geometry.targets) {
    expect(target.width, `${target.name} width`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.name} height`).toBeGreaterThanOrEqual(44);
  }
  const header = await page.locator(".header").boundingBox();
  expect(header!.y + header!.height).toBeLessThan(geometry.nav.top);
}

test.beforeEach(async ({ page }) => {
  // Keep the no-key preview deterministic and avoid remote assets/service costs.
  await page.route(
    /https:\/\/(images\.unsplash\.com|fonts\.(googleapis|gstatic)\.com)/,
    (route) => route.abort(),
  );
});
for (const width of [320, 375, 390, 430]) {
  test(`mobile app navigation and layout at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "App navigation" });
    await expect(
      nav.getByRole("link", { name: "Discover", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const symbol = page.locator(".header .brand-symbol");
    await expect(symbol).toBeVisible();
    await expect(page.locator(".header .brand-wordmark")).toHaveText("DUSK");
    await expect(page.locator(".header .brand-wordmark")).toHaveCSS(
      "color",
      "rgb(255, 255, 255)",
    );
    const brandingBox = (await page.locator(".header .logo").boundingBox())!;
    const cityBox = (await page.locator(".header .city-select").boundingBox())!;
    expect(brandingBox.x + brandingBox.width + 8).toBeLessThanOrEqual(
      cityBox.x,
    );
    await expect
      .poll(() =>
        symbol.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBe(1382);
    const symbolBox = (await symbol.boundingBox())!;
    expect(symbolBox.width / symbolBox.height).toBeCloseTo(1382 / 1138, 2);
    await expect(page.locator(".header .logo")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(page.locator(".header .logo")).toHaveCSS(
      "border-top-width",
      "0px",
    );
    await expect(page.locator(".hero")).toBeHidden();
    await expect(page.locator(".mobile-intro")).toContainText("$1 Drinks.");
    await expect(page.getByLabel("Choose city")).toBeInViewport();
    await expect(page.getByLabel("Search spots")).toBeInViewport();
    await expect(page.locator(".card").first()).toBeInViewport();
    await assertLayout(page);
    await page.screenshot({ path: testInfo.outputPath("discover.png") });
    await page.getByLabel("Save The Velvet Room", { exact: true }).click();
    await nav.getByRole("link", { name: "Saved", exact: true }).click();
    await expect(page).toHaveURL(/#saved$/);
    await expect(page.locator(".card")).toHaveCount(1);
    await expect(page.locator(".card")).toContainText("The Velvet Room");
    await assertLayout(page);
    await page.reload();
    await expect(page.locator(".card")).toHaveCount(1);
    await nav.getByRole("link", { name: "Discover", exact: true }).click();
    await page.getByLabel("Choose city").selectOption("New York City");
    await page.getByLabel("Search spots").fill("Juniper");
    await page.getByRole("button", { name: "Cocktails", exact: true }).click();
    await nav.getByRole("link", { name: "Map", exact: true }).click();
    await expect(page.getByLabel("Choose city")).toHaveValue("New York City");
    await expect(page.getByLabel("Search spots")).toHaveValue("Juniper");
    await expect(
      page.getByRole("button", { name: "Cocktails", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText(/no Google Maps key is configured/),
    ).toBeVisible();
    await expect(page.locator(".card")).toHaveCount(1);
    await expect(page.locator(".card")).toContainText("Juniper");
    await assertLayout(page);
    await nav.getByRole("link", { name: "Saved", exact: true }).click();
    await expect(page.getByText("No spots here yet.")).toBeVisible();
    await page.getByRole("button", { name: "Back to Discover" }).click();
    await expect(page).toHaveURL(/#discover$/);
    await expect(page.getByLabel("Search spots")).toHaveValue("");
    await page.getByLabel("Choose city").selectOption("Atlantic City");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const lastCard = await page.locator(".card").last().boundingBox();
    const bar = await nav.boundingBox();
    expect(lastCard!.y + lastCard!.height).toBeLessThanOrEqual(bar!.y);
    await expect(page.locator("footer > p")).toHaveText(
      "Don't Waste The Night.",
    );
    await expect(page.locator("footer > p")).toBeVisible();
    await expect(page.locator("footer > span")).toHaveText(
      "© 2015-2026 Dusk App LLC",
    );
    await expect(page.locator("footer > span")).toBeVisible();
    expect(
      (await page.locator("footer > span").boundingBox())!.y +
        (await page.locator("footer > span").boundingBox())!.height,
    ).toBeLessThanOrEqual((await nav.boundingBox())!.y);
    await assertLayout(page);
  });
}
test("browser history, deep links and saved empty-state return", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto("/#saved");
  await expect(page.getByText("No saved spots yet.")).toBeVisible();
  await page.getByRole("button", { name: "Back to Discover" }).click();
  const nav = page.getByRole("navigation", { name: "App navigation" });
  await nav.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page).toHaveURL(/#map$/);
  await page.goBack();
  await expect(
    nav.getByRole("link", { name: "Discover", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page.getByText("No saved spots yet.")).toBeVisible();
  await page.goForward();
  await expect(
    nav.getByRole("link", { name: "Discover", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(
    nav.getByRole("link", { name: "Map", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
test("bottom safe-area clearance and desktop navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.goto("/");
  // Simulate a 34px iPhone home-indicator inset in Chromium's desktop test runner.
  await page.addStyleTag({
    content:
      ":root{--bottom-safe-area:34px!important;--top-safe-area:47px!important}",
  });
  const nav = page.getByRole("navigation", { name: "App navigation" });
  expect((await nav.boundingBox())!.height).toBe(102);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const lastCard = await page.locator(".card").last().boundingBox();
  expect(lastCard!.y + lastCard!.height).toBeLessThanOrEqual(
    (await nav.boundingBox())!.y,
  );
  await assertLayout(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("footer > p")).toHaveText("Don't Waste The Night.");
  await expect(page.locator("footer > p")).toBeVisible();
  await expect(page.locator("footer > span")).toHaveText(
    "© 2015-2026 Dusk App LLC",
  );
  await expect(page.locator("footer > span")).toBeVisible();
  await expect(page.locator(".hero")).toBeVisible();
  await expect(page.locator(".header .brand-wordmark")).toHaveText("DUSK");
  await expect(page.locator(".header .brand-symbol")).toBeVisible();
  await expect(page.locator(".header .brand-full")).toHaveCount(0);
  expect((await nav.boundingBox())!.y).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1280,
  );
  await nav.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page.getByText("No saved spots yet.")).toBeVisible();
});

// Exercise real DOM/CSS sizing and marker selection without loading Google's service.
async function installMapStub(page: Page) {
  await page.route(
    /\/src\/components\/VenueMap\.tsx(?:\?|$)/,
    async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        "import.meta.env.VITE_GOOGLE_MAPS_API_KEY",
        '"browser-test-only"',
      );
      await route.fulfill({ response, body });
    },
  );
  await page.route(/\/src\/maps\/loader\.ts(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    export async function loadGoogleMaps(){
      class Map{constructor(element){this.element=element;element.replaceChildren();}setCenter(){}setZoom(){}fitBounds(){}panTo(){}}
      class AdvancedMarkerElement{constructor(options){this.content=options.content;this.map=options.map;}set map(value){this._map=value;if(this.content){if(value)value.element.append(this.content);else this.content.remove();}}get map(){return this._map;}}
      window.google={maps:{Map,ColorScheme:{DARK:'DARK'},LatLngBounds:class{extend(){}},marker:{AdvancedMarkerElement}}};return window.google;
    }
  `,
    }),
  );
}
for (const width of [320, 375, 390, 430]) {
  test(`mobile map is higher, larger, and safe at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await installMapStub(page);
    await page.goto("/#map");
    await expect(page.getByText(/4 filtered demo venue pins/)).toBeVisible();
    const canvas = page.locator(".map-canvas");
    const box = (await canvas.boundingBox())!;
    expect(box.y).toBeLessThan(330);
    expect(box.height).toBeGreaterThanOrEqual(400);
    const nav = page.getByRole("navigation", { name: "App navigation" });
    expect(box.y + box.height).toBeLessThanOrEqual(
      (await nav.boundingBox())!.y,
    );
    await expect(page.getByLabel("Search spots")).toBeInViewport();
    const categories = page.getByRole("group", { name: "Filter by category" });
    const row = await categories
      .locator("button")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().y),
      );
    expect(new Set(row).size).toBe(1);
    expect(
      await categories.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Late night", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".map-canvas button")).toHaveCount(1);
    await page.getByRole("button", { name: "All spots", exact: true }).click();
    await expect(page.locator(".map-canvas button")).toHaveCount(4);
    await assertLayout(page);
    await page.screenshot({ path: testInfo.outputPath("map-stub.png") });
    await page.locator(".map-canvas button").first().click();
    await expect(page.getByRole("dialog")).toContainText(
      "Demo location — directions unavailable",
    );
    await expect(page.locator('a[href*="/maps/dir/"]')).toHaveCount(0);
    await page.getByLabel("Close venue details").click();
    await page.getByLabel("Search spots").fill("Velvet");
    await expect(page.locator(".map-canvas button")).toHaveCount(1);
    await page.getByLabel("Choose city").selectOption("New York City");
    await page.getByLabel("Search spots").fill("");
    await expect(page.locator(".map-canvas button")).toHaveCount(2);
    await assertLayout(page);
  });
}

test("desktop map keeps its layout and blocks demo directions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installMapStub(page);
  await page.goto("/#map");
  await expect(page.getByText(/4 filtered demo venue pins/)).toBeVisible();
  const canvas = (await page.locator(".map-canvas").boundingBox())!;
  expect(canvas.height).toBe(430);
  await expect(page.locator(".map-intro-desktop")).toBeVisible();
  await expect(page.locator(".map-intro-mobile")).toBeHidden();
  const results = (await page.locator(".results-row").boundingBox())!;
  expect(results.y + results.height).toBeLessThan(canvas.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1280,
  );
  await page.locator(".map-canvas button").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Demo location — directions unavailable",
  );
  await expect(
    page.getByRole("dialog").getByRole("link", { name: /directions/i }),
  ).toHaveCount(0);
});
