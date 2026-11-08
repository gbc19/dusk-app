import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./main";
import { filterDeals, directionsUrl, deals } from "./data";
beforeEach(() => vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", ""));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllEnvs();
});
test("filters city, category, search, and saved spots together", () => {
  expect(
    filterDeals("Atlantic City", "$1 drinks", "velvet", false, []).map(
      (d) => d.id,
    ),
  ).toEqual([1]);
  expect(filterDeals("New York City", "All spots", "", false, [])).toHaveLength(
    2,
  );
  expect(filterDeals("Atlantic City", "All spots", "", true, [2])).toEqual([
    deals[1],
  ]);
  expect(filterDeals("Atlantic City", "Beer", "velvet", false, [])).toEqual([]);
});
test("saves a spot and shows it in saved view", () => {
  render(<App />);
  fireEvent.click(screen.getByLabelText("Save The Velvet Room"));
  fireEvent.click(screen.getByRole("link", { name: "Saved" }));
  expect(screen.getByText("The Velvet Room")).toBeInTheDocument();
  expect(screen.queryByText("Ember & Violet")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("dusk-saved")!)).toEqual([1]);
});
test("city switching and search update displayed venues", () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Choose city"), {
    target: { value: "New York City" },
  });
  expect(screen.getByText("Juniper & Co.")).toBeInTheDocument();
  expect(screen.queryByText("The Velvet Room")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search spots"), {
    target: { value: "no match" },
  });
  expect(screen.getByText("No spots here yet.")).toBeInTheDocument();
});
test("details prohibit redemption and label directions as demo coordinates", () => {
  render(<App />);
  fireEvent.click(screen.getByText("The Velvet Room"));
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "No offer can be purchased or redeemed",
  );
  expect(
    screen.getByRole("link", { name: /Directions to demo coordinates/ }),
  ).toHaveAttribute("href", directionsUrl(deals[0]));
  fireEvent.click(screen.getByLabelText("Close venue details"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("missing map key keeps a visible venue list and sends no map request", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  expect(screen.getByText(/no Google Maps key is configured/)).toBeVisible();
  expect(screen.getByText("The Velvet Room")).toBeVisible();
  expect(
    document.querySelector('script[src*="maps.googleapis.com"]'),
  ).toBeNull();
});
test("venue images fall back to a local asset without a retry loop", () => {
  render(<App />);
  const images = screen
    .getAllByRole("img")
    .filter((image) => image.closest(".card-image"));
  expect(images).toHaveLength(4);
  for (const image of images) {
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "/images/venue-fallback.svg");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "/images/venue-fallback.svg");
  }
});
test("detail dialog traps keyboard focus and returns it on Escape", () => {
  render(<App />);
  const trigger = screen.getByText("The Velvet Room");
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(screen.getByText("Save this spot")).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(screen.getByLabelText("Close venue details")).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test("app navigation shares filters and city while Saved keeps existing local deals", () => {
  localStorage.setItem("dusk-saved", JSON.stringify([5]));
  render(<App />);
  const nav = screen.getByRole("navigation", { name: "App navigation" });
  expect(nav.querySelectorAll("a")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Choose city"), {
    target: { value: "New York City" },
  });
  fireEvent.change(screen.getByLabelText("Search spots"), {
    target: { value: "Juniper" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cocktails" }));
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  expect(window.location.hash).toBe("#map");
  expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByLabelText("Choose city")).toHaveValue("New York City");
  expect(screen.getByLabelText("Search spots")).toHaveValue("Juniper");
  expect(screen.getByRole("button", { name: "Cocktails" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("link", { name: "Saved" }));
  expect(
    screen.getByRole("heading", { name: "Saved spots" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Juniper & Co.")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Unsave Juniper & Co."));
  expect(screen.getByText("No saved spots yet.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to Discover" }));
  expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByLabelText("Search spots")).toHaveValue("");
  expect(screen.getByRole("button", { name: "All spots" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
