# Google Maps browser setup and cost controls

## What the app requests

The optional map uses the Maps JavaScript API and its marker library, with AdvancedMarkerElement and the Google-provided `DEMO_MAP_ID` for development. The key comes from `VITE_GOOGLE_MAPS_API_KEY`. No Maps embed remains; no Places library, Places search, Geocoding, or Directions API requests are made. Venue positions are bundled explicit demo coordinates. Directions links use the public Google Maps URL interface, opened only on a click.

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

Every venue has `demoLocation: { lat, lng, kind: 'demo' }` on its venue record. These are invented locations in the selected market, not actual addresses of the fictional venue. Map labels, marker titles, and detail/directions copy identify this explicitly. Do not use these coordinates for a real launch; replace with verified onboarding data and redesign the `kind` contract when genuine venues are introduced. Coordinates are not obtained by guessing addresses or calling a geocoder.
