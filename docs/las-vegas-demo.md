# Las Vegas demonstration market

Phase 6A adds seven fictional venues and $1 previews. All remain non-redeemable. Existing Atlantic City and New York City fixtures, numeric saves 1–6, branding, and map rendering remain compatible. New Vegas saves use explicit IDs 7–13. No backend or additional Maps service is involved.

The shared registry in src/domain/markets.ts defines stable market IDs, consumer-facing names, state, map centers, and IANA time zones. Both map paths use it at creation and when filters produce no pins. Las Vegas uses America/Los_Angeles. Consumer markets can span multiple licensing jurisdictions; city, neighborhood, and demo pin coordinates never establish a legal jurisdiction or license approval. A future real venue workflow must verify jurisdiction separately.

The initial selected city is Las Vegas when dusk-market has no recognized value. Changing the selector stores the stable market ID. Recognized display-name preferences are accepted too. The previous app did not persist city selections, so an old unsaved selection cannot be recovered. Existing saved spots are preserved and never used to infer a city preference. Storage failure leaves selection functional for the session. Browser and Android storage remain separate.

Every Vegas card uses the existing preview badge and a FICTIONAL DEMO VENUE label. Details explicitly explain the imaginary venue, non-redeemability, and representative pin. Demo records have neither real street addresses nor verifiedLocation. No directions are enabled. All seven qualify for $1 drinks; the existing Cocktails, Beer, and Late night filters also match appropriate previews without changing the card or marker design.

Sample offer contracts use USD 100 cents and daily 18:00–20:00 local windows, matching the displayed sample hours. They validate through validateOfferCatalog but remain isDemo/preview/not-applicable. isOfferScheduled always returns false for them. The calendar date range is sample data, not authorization or availability.

Geographic checks were performed on November 18, 2026 against the geotagged source photographs below. These are representative area points, including streets and viewpoints, not verified venue entrances. The invented names and venue types have no relationship to businesses visible in source imagery or located under map pins. Source images are not added to the app. Existing generic preview photography remains illustrative.

| Fictional venue | Area | Demo latitude, longitude | Geographic reference |
| --- | --- | --- | --- |
| Cinder Circuit | Fremont area | 36.169221, -115.140688 | [Geotagged photograph](https://commons.wikimedia.org/wiki/File%3ALas%20Vegas%20Bouldevard%20and%20Fremont%20Street.jpg) |
| Saffron Static Lounge | Arts District | 36.159596, -115.151860 | [Geotagged photograph](https://commons.wikimedia.org/wiki/File%3AArts%20District%2C%20Las%20Vegas%2C%20United%20States%20(Unsplash).jpg) |
| Overtime Mirage | Arts District | 36.160885, -115.152168 | [Geotagged photograph](https://commons.wikimedia.org/wiki/File%3AArts%20District%2C%20Las%20Vegas%2C%20NV%2C%20USA%20-%20panoramio.jpg) |
| Copper Comet Rooftop | Downtown east | 36.167059, -115.135555 | [Geotagged photograph](https://commons.wikimedia.org/wiki/File%3ADowntown%2C%20Las%20Vegas%2C%20United%20States%20(Unsplash).jpg) |
| Prism Tumble Club | North Strip area | 36.126114, -115.168464 | [Geotagged photograph](https://commons.wikimedia.org/wiki/File%3A2015-01-16%2000%2012%2056%20View%20south%20at%20night%20along%20Las%20Vegas%20Boulevard%20near%20Sands%20Avenue%20in%20Las%20Vegas%2C%20Nevada.JPG) |
| Velour Voltage | Center Strip area | 36.114658, -115.172859 | [Geotagged photograph](https://commons.wikimedia.org/wiki/File%3ALas%20Vegas%20Strip%20Traffic%20(22574558220).jpg) |
| Desert Signal Taproom | South Strip area | 36.101526, -115.173068 | [Geotagged photograph](https://commons.wikimedia.org/wiki/File%3ALas%20Vegas%20Boulevard%2C%20overview%20of%20the%20huge%20streets%20(7315599602).jpg) |

To update a Windows Git checkout, open PowerShell in its repository root and run the commands below. If git status shows unrelated changes, save that work before switching branches or pulling. A ZIP download has no Git history; download a fresh ZIP of feat/dusk-nightlife-app into a separate directory or use a Git clone. Keep any existing machine-specific Maps configuration in place.

```powershell
git status --short
git fetch origin
git switch feat/dusk-nightlife-app
git pull --ff-only origin feat/dusk-nightlife-app
npm ci
npm test
npm run build
npm run native:sync:android
npm run native:open:android
```

In Android Studio, let Gradle sync finish, select the app run configuration and the existing Pixel 8 emulator, then click Run. The native sync command rebuilds and copies the native-mode web bundle. Running only the web development server will not update the installed Android app. Keep the existing restricted Android key and package/certificate configuration.

On the Pixel 8, verify these steps.

1. Open Discover. On an installation without a saved market, Las Vegas is selected. On an existing installation, select Las Vegas manually if a different preference is retained. Expect seven fictional cards and $1 previews.
2. Open Map. Confirm live tiles cover downtown and the Strip, with seven pins. Pan and pinch. Tap each pin and check the matching venue details, fictional notice, and unavailable directions.
3. Search Overtime. Expect one matching card and pin. Clear search. Beer shows two, Cocktails three, Late night two, and $1 drinks seven.
4. Select Atlantic City, New York City, then Las Vegas with All spots and empty search. Expect four, two, and seven cards/pins. An empty-result search must leave the map centered on the selected market.
5. Save a Vegas spot, switch to Saved, force-close and reopen. Confirm the chosen city and save persist. Existing saves in other markets remain available after selecting those markets.
6. Rotate, navigate between tabs, open/close details, and use system Back. Check touch handling, safe areas, and map transparency.
7. Test unavailable network/Maps and confirm the filtered venue list remains usable. Tile/network failures can leave the native SDK view blank without an initialization error; this existing SDK limitation remains.

For browser checking, run npm run dev and open the displayed local address. npm run test:e2e runs Chromium tests with a Maps stub and blocked external images/fonts, without live Maps usage. Real Android tiles, physical gestures, and release signing require separate device verification.
