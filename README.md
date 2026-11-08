# DUSK 2.0

A React + TypeScript nightlife discovery preview for Atlantic City and New York City, built with Vite. Includes Discover, Map, and Saved destinations with shared city/search/category filters, device-local saved spots, venue detail dialogs, and an optional Google Maps JavaScript venue map. Phones use a fixed, safe-area-aware bottom bar and compact cards; desktop keeps a spacious layout.

All venues, offers, hours, and map coordinates are fictional. Offers are non-redeemable previews pending local regulatory approval and venue confirmation. No purchase, booking, payment, or redemption is implemented. Content is intended for adults 21+.

## Preview in your existing GitHub Codespace

From the repository terminal (save any unrelated local edits before switching branches):

```sh
git fetch origin
git switch feat/dusk-nightlife-app
git pull --ff-only
npm ci
cp -n .env.example .env.local
npm run dev -- --port 5173 --strictPort
```

Requires Node.js 22.12+ (or 20.19+). In the Codespace **Ports** panel, open port **5173** in your browser. Keep the forwarded port private. The app works immediately without a Maps key: choose **Map** to see the explanatory fallback above the working venue list.

To test the actual map, set `VITE_GOOGLE_MAPS_API_KEY` in your untracked `.env.local` using an existing appropriately restricted Google Maps browser key, then restart Vite. Never put a key into a tracked file, PR comment, or chat. See [Maps setup and cost controls](docs/google-maps.md) before using a key. Vite browser keys are visible in the browser bundle, so restrictions are essential; `.env.local` prevents accidental source commits, not browser exposure.

## Mobile app navigation

The three navigation links are **Discover**, **Map**, and **Saved**. They use `#discover`, `#map`, and `#saved` destinations, support direct links and browser back/forward, and keep the selected market, search, and category while moving between screens. A repeated tap on the active destination returns to the top without adding a history entry. Search/filter state stays in memory and resets on a full reload; saved deal IDs retain the existing `dusk-saved` local-storage format.

On phones (below 768px), the logo and market selector stay in a compact sticky header, and the large hero is replaced with a short $1 Drinks introduction. Search, category buttons, and compact cards come first. Navigation icons have text labels and `aria-current`; tap targets are at least 44px. The bottom bar and page padding include iPhone safe-area space, with `viewport-fit=cover`. Saved has a useful empty state and a Back to Discover action. The Map destination keeps the list fallback and offers an optional **Saved only** marker filter.

## Development checks

```sh
npm test
npm run build
```

The build writes `dist/`. Tests use Vitest, React Testing Library, and a mocked Google Maps SDK: no billable map calls, Places lookups, or Geocoding calls. GitHub Actions runs the build, unit tests, and Chromium layout tests for pull requests. To run the browser checks yourself:

```sh
npx playwright install chromium
npm run test:e2e
```

The runner uses `/usr/bin/chromium` when present, otherwise Playwright's installed Chromium. You can override it with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. It starts and stops its own local Vite server on port 4173 with the Maps key blank, and blocks third-party photos/fonts to exercise local fallbacks. Screenshots are saved under ignored `test-results/`. No paid browser-testing service is used.

## Branding and assets

The palette uses charcoal/black, deep purple, warm orange, and restrained gradients. No original sun-and-crescent logo was found in the repository. `public/images/dusk-logo-placeholder.svg` is explicitly temporary, labeled **TEMP MARK** in the UI. Needed asset: the approved original DUSK sun-and-crescent SVG (preferably transparent, with a version suitable for dark backgrounds). Replace the placeholder and remove the temporary label when supplied; this drawing is not claimed as the original brand mark.

Venue and hero photography comes from Unsplash. Low Tide's unavailable image was replaced with a working bar image. All cards and the hero fall back to the bundled `public/images/venue-fallback.svg` on image failure. Google Fonts is optional: system font fallbacks remain available when offline.

## Map behavior

Maps loads only when the Map destination is first opened with a configured key. The instance stays mounted when switching destinations and is reused for market, search, category, and saved-spot changes. One marker represents each currently visible fictional venue. Select a marker to open the same accessible offer preview used by the list. Its directions link opens Google Maps at explicitly labeled **demo coordinates**, not a verified venue location.

The complete filtered card list stays visible below the map. Missing keys, script/network failures, a 15-second load timeout, and Google authorization failures show an explanatory fallback. Location is requested only after pressing **Use my location**; the browser controls permission. It is optional, held in component memory for the session, not saved to local storage or sent to a DUSK backend, and provided to Google Maps to center the map. Denied/unavailable location leaves manual browsing intact. Codespaces HTTPS (or localhost) is required for browser geolocation.

## Data model foundation

[Data model design](docs/data-model.md) documents venue, customer, and staff contracts and future relationships. Offers reference shared venue IDs; numeric saved-deal IDs remain compatible. Customer/staff types are not instantiated or persisted. Promoter profiles, nightlife events, guest lists, and table reservations remain fixed off with no MVP UI, backend, or services.

Saved spots stay in browser local storage with a session-only fallback if storage fails. There is no backend or user account system. Real inventory, verified addresses, approval status, age verification, and redemption require later implementation.

## Verification limits

Automated tests cover map marker/filter synchronization, marker previews/directions, SDK load/authorization failures and timeout, optional location success/denial, image fallback, keyboard focus, existing discovery/saving, and fixture integrity. The real Google Maps service and billing/key restrictions have not been exercised: no key or paid service was provisioned. Chromium layout/navigation checks pass at 320, 375, 390, and 430 CSS pixels, with simulated 34px bottom and 47px top iPhone insets and a desktop check at 1280px. They check horizontal overflow, 44px tap targets, bottom clearance, shared filters, persisted saved deals, and browser history. Real iPhone Safari safe-area/keyboard behavior and key-backed Google Maps rendering still require device verification before release.

No deployment, merge, paid-service activation, or real alcoholic promotion is part of this change.
