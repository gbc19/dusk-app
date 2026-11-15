# DUSK native prototype

Capacitor **8.6.2** packages the React/Vite output in `dist` for Android and iOS. Use Node.js 22.12 or newer for this repo. The native projects use the name **DUSK** and the temporary local ID `com.example.dusk.prototype`. Before registering either app or inviting beta testers, the founder should confirm a permanent reverse-DNS identifier based on a company-controlled domain and approve it in `capacitor.config.ts`, Android's namespace/application ID and Java package, and Xcode's bundle ID. A different app ID installs as a separate app and has separate Saved data.

The packaged prototype uses the existing six fictional, non-redeemable offers for Atlantic City and New York City. Las Vegas is the planned market. The website remains a separate workstream, and `npm run dev` and `npm run build` still use the web configuration.

## Android on Windows

Install a Capacitor 8-compatible [Android Studio](https://capacitorjs.com/docs/getting-started/environment-setup), Android SDK **36** and platform-tools. Select **JDK 21** for the generated Gradle project. The Android project targets API 36 with a minimum of API 24.

```powershell
npm ci
npm run native:sync:android
npm run native:open:android
```

In Android Studio, allow Gradle sync, select the `app` run configuration and a USB-debugging phone or emulator, then click **Run**. Android Studio uses debug signing for local installs. With the SDK and device set up, the command-line equivalent from the repository root is:

```powershell
Push-Location android
.\gradlew.bat installDebug
Pop-Location
```

## iOS on macOS

The Xcode project is checked in and uses Swift Package Manager. Use macOS with **Xcode 26 or newer**, Xcode Command Line Tools, and a device compatible with the iOS 15+ deployment target. After cloning:

```sh
npm ci
npm run native:sync:ios
npm run native:open:ios
```

In the **App** target's **Signing & Capabilities**, select your development team, resolve signing for the bundle ID, choose a connected iPhone, and click **Run**. A Personal Team can be used for founder-local testing, subject to Apple's provisioning limits. Investor distribution through TestFlight requires a founder-owned Apple Developer Program team, a registered app, distribution signing, and App Store Connect. Play testing likewise needs a founder-owned Play Console account and signing setup. Keep signing materials outside the repository.

## Maps and bundle refresh

Use the platform-specific sync scripts after each web change. They run `npm run build:native` before copying `dist`. The native Vite mode excludes the normal `VITE_` variables, including the website Maps key, even if present in local configuration. Both build modes write to `dist`; avoid syncing the result of an ordinary website build into either wrapper. Copied assets and generated Capacitor JSON remain local.

The wrapper uses the venue-list fallback and makes no Google Maps SDK request with its default build. Live Maps inside native WebViews has not been verified. Bundled origins may omit the referrer required by the browser key. For the first demo, show live Maps separately in an authorized HTTPS browser preview. If native Maps is essential, evaluate the official Android and iOS Maps SDKs through a Capacitor-compatible integration using separate keys restricted to the Android package and signing fingerprint, and iOS bundle ID, respectively. Keep website key restrictions intact and review costs before enabling any SDK. [Google Maps key guidance](https://developers.google.com/maps/api-security-best-practices)

## Native device checklist

- Confirm the app opens without a dev server and the six fictional previews stay labeled, including in details. Try airplane mode and verify the venue list and local image fallback.
- Check portrait and landscape, system bars and safe areas, category swipes, search keyboard, and the detail modal. On Android, test system Back from Map, Saved, and a detail modal. On iOS, verify navigation after suspend/resume.
- Save a venue, force-close and reopen the app, and confirm the save persists. Browser and native saves use separate storage.
- Open Map and verify the no-key explanation and a usable list. There should be no location permission prompt in this default wrapper. Use the [physical-device Maps checklist](google-maps.md#physical-device-checklist) separately in the authorized HTTPS browser preview. Current demo details expose no directions link. Verify system-browser handling before adding any real external links.

Android and iOS projects were generated with the Capacitor CLI on Windows. Gradle builds, Xcode builds, signing, actual installs, and native device behavior require platform tools or devices. The native launcher and splash art are the generated defaults and can be replaced with approved DUSK assets before investor distribution.
