# Google Maps browser setup and cost controls

## What the app requests

The optional map uses the Maps JavaScript API and its marker library, with AdvancedMarkerElement and the Google-provided `DEMO_MAP_ID` for development. The key comes from `VITE_GOOGLE_MAPS_API_KEY`. No Maps embed remains; no Places library, Places search, Geocoding, or Directions API requests are made. Venue positions are bundled explicit demo coordinates. Fictional venues never render a directions link. Their details show `Demo location — directions unavailable`. The URL helper is reserved for future explicitly real venues with independently verified coordinates.

Maps initializes on the first visit to the Map destination with a key. Filtering replaces markers and fits the existing map rather than creating new maps. Moving among Discover, Map, and Saved preserves that instance; hidden map markers are removed and restored when Map is active. The Map screen also includes a Saved only filter. Refreshing the page or remounting the app can create another map load. These optimizations reduce unnecessary loads; they do not make Google Maps free. Advanced markers/map IDs use Google's applicable Dynamic Maps billing model. Review current Google Maps Platform pricing and terms before enabling service. Replace `DEMO_MAP_ID` with a project-owned JavaScript map ID before any production release.

No Google Cloud resource or billing configuration has been created by this PR. Without a key, the app makes no Maps script request and uses the visible venue list. All features remain preview-only even if you supply a key.

## Use an existing browser key safely

1. In the relevant Google Cloud project, enable **Maps JavaScript API** only if you are authorized to enable its potentially billable usage. Google may require a linked billing account. No other Maps API is needed here.
2. Use a dedicated development browser key. Under **Application restrictions**, select **Websites (HTTP referrers)**. Permit only actual preview origins, such as `http://localhost:5173/*`, `http://127.0.0.1:5173/*`, and `https://YOUR-EXACT-CODESPACE-NAME-5173.app.github.dev/*`. Copy the actual forwarded Codespaces browser origin if its domain differs. Do not broadly allow `*.app.github.dev` or unrestricted websites. Keep the forwarded port private.
3. Under **API restrictions**, restrict that key to **Maps JavaScript API**. Use separate keys/projects for development and a later production release; add only the exact production origin to the production key.
4. Set `VITE_GOOGLE_MAPS_API_KEY=...` in `.env.local` (ignored by Git), then restart Vite. The value is deliberately public in the client bundle. Do not use a server credential or rely on environment files as secrecy once bundled.
5. Verify the map on your actual allowed Codespaces origin. `RefererNotAllowedMapError`, API-disabled, invalid-key, and billing errors should leave the venue list usable. Inspect the browser console/Cloud metrics privately; don't paste a key into logs or issues. After correcting a key or restriction, reload the page to retry the loader.

## Usage limits and billing alerts

Before sharing a key-backed preview:

- In **Google Maps Platform → Quotas** (or **APIs & Services → Maps JavaScript API → Quotas & System Limits**), review the available project/API quotas. Set conservative adjustable request limits appropriate to a small private preview; configure daily limits if the applicable product exposes them. Quota names and available dimensions vary. Do not assume all quota limits are adjustable or equivalent to spending caps.
- Configure **Cloud Billing → Budgets & alerts** with a small budget scoped to the preview project and alerts at early thresholds (for example 50%, 80%, and 100%). Enable available email notifications to the people responsible for billing. Budget alerts notify and may be delayed; they do not automatically stop spending.
- Monitor Maps API metrics and billing reports after manual testing. Tighten adjustable quotas if usage exceeds expectations. Disable the key/API or remove the local key to stop this app's future map loads if needed; charges already incurred remain possible.
- Recheck current pricing, free allowances, quotas, and billing terms in the Cloud console. Do not rely on an assumed free tier, a wildcard referrer rule, or this app's feature flags as cost controls.

The list fallback is the supported no-key/no-Maps-cost preview path. No paid account, trial, or additional Google service needs to be purchased to review the rest of the app.

## Demo location boundary

Every current demo venue has `demoLocation: { lat, lng, kind: 'demo' }`. The positions are invented and used only for preview pins. Future real venues use independently verified coordinates. See [Introducing verified venues](data-model.md#introducing-verified-venues).

## Directions eligibility

`src/domain/directions.ts` uses the same location rule as map pins and additionally requires a real venue. A published real record with an address and valid `verifiedLocation: { lat, lng, verified: true }` can receive a pin and directions. A published real venue without verified coordinates remains list-only. Preview venues never receive directions, even if verified coordinates are mistakenly attached.

## Physical-device checklist

Run once in **Safari on an iPhone** and once in **Chrome on an Android phone**. Record device, OS/browser version, commit, orientation, and results. Use an existing private trusted HTTPS preview on an origin already allowed by the development key. Leave current referrer and API restrictions in place. Plain HTTP on a Wi-Fi IP is unsuitable for testing browser geolocation.

1. **Portrait:** Open Discover. Check that the first offer is visible sooner, the next filter chip peeks into view, and only the chip row moves sideways. Open Map and check the search field, map controls, sticky header, and bottom navigation against the notch and home indicator.
2. **Live tiles and gestures:** Confirm tiles appear. Pan, pinch, and zoom with map controls. Swipe the filter strip without moving the map. Change market, search, and category, then check that pins and the list agree.
3. **Selection and navigation:** Tap a fictional pin and its matching card. Confirm the full non-redemption notice and **Demo location — directions unavailable**. Save a spot, switch between Discover, Map, and Saved, and use browser Back. Rotate to landscape and back with Map open and repeat while Map is hidden. Check for blank tiles, clipped controls, and lost saves.
4. **Location:** Start with a fresh site permission state. Verify there is no prompt until **Use my location** is tapped. Deny and confirm browsing still works. Reset permission and allow while using the site. Verify the map recenters, then reload and confirm location is not restored by DUSK. Try with system location disabled if available.
5. **Fallback:** Use a separate no-key test process or block the Maps script through device debugging while keeping the app reachable. Confirm the status explains the failure and the filtered list, navigation, and saves still work. Keep the existing key configuration intact.

Chromium checks use four CSS-pixel widths, a stubbed SDK for markers and resize/re-entry, and a simulated map error and no-key fallback. Component tests cover location opt-in, denial, and success. These checks do not verify live tiles, WebView referrers, physical gestures, OS permission prompts, or actual safe-area insets.

See [Native app feasibility](native-app-feasibility.md) for WebView-specific Maps and location checks.
