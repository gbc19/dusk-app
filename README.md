# DUSK 2.0

A React + TypeScript nightlife discovery prototype for Atlantic City and New York City, built with Vite. Includes category and text filters, saved spots stored on the device, venue detail dialogs, responsive layouts, and Google Maps city/neighborhood embeds.

## Develop

Requires Node.js 22.12+ (or 20.19+).

```sh
npm ci
npm run dev
npm test
npm run build
```

The production build is written to `dist/`. `npm test` runs Vitest and React Testing Library checks for combined filtering, saving, city switching, empty states, and venue details.

## Product status

All venues, hours, and promotions are fictional demo content. No purchase, booking, payment, or redemption is implemented. The app prominently labels the preview and requires venue confirmation and local regulatory approval before any real promotion goes live. Content is intended for adults 21+.

Google Maps uses public embeds without an API key. Maps show city or neighborhood areas, not fictional venue pins. A production venue map will need verified addresses, coordinates, and an appropriately restricted Google Maps Platform key if migrating to the JavaScript API. Third-party maps, Unsplash photos, and Google Fonts require internet access.

Saved spots stay in browser local storage, with a session-only fallback when storage is unavailable. There is no backend or user account system. Real inventory, approval status, age verification, and redemption require a later backend integration.

## Data model foundation

[Data model design](docs/data-model.md) documents venue, customer, and staff contracts and future relationship boundaries. Offers reference shared venue IDs; existing saved-deal IDs remain compatible. Customer and staff types are not instantiated or persisted. Promoter profiles, nightlife events, guest lists, and table reservations remain fixed off with no MVP UI, backend, or added services.
