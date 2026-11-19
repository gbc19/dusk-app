# DUSK native prototype

Capacitor **8.6.2** packages the React/Vite output in `dist` for Android and iOS. Use Node.js 22.12 or newer for this repo. The native projects use the name **DUSK** and the temporary local ID `com.example.dusk.prototype`. Before registering either app or inviting beta testers, the founder should confirm a permanent reverse-DNS identifier based on a company-controlled domain and approve it in `capacitor.config.ts`, Android's namespace/application ID and Java package, and Xcode's bundle ID. A different app ID installs as a separate app and has separate Saved data.

The packaged prototype uses the existing thirteen fictional, non-redeemable previews across Las Vegas, Atlantic City, and New York City. Las Vegas is the initial default market. See [Vegas update and emulator checks](las-vegas-demo.md). The website remains a separate workstream, and `npm run dev` and `npm run build` still use the web configuration.

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

### Enable Android Maps for a local debug build

1. Use the Pixel emulator image with Google Play services. From the repository root, run `npm ci` and `npm run native:sync:android`. From `android\`, run `.\gradlew.bat :app:signingReport`. Use the SHA-1 for the debug variant that signs the APK you will install.
2. In an approved, billing-enabled Google Cloud project, enable **Maps SDK for Android**. Create a separate Android debug key in **APIs & Services → Credentials**. Set **Application restrictions → Android apps** to package `com.example.dusk.prototype` and the debug SHA-1. Set **API restrictions → Restrict key → Maps SDK for Android**. Keep the browser key and its restrictions as they are. Google requires billing to be enabled for this SDK. Standard mobile map loads without a cloud Map ID are listed at no charge under the Maps SDK SKU. This prototype uses no Map ID, additional Maps APIs, or location permissions. [Android key setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key) · [Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
3. In your **user Gradle home**, usually `%USERPROFILE%\.gradle\gradle.properties` on Windows (or under `GRADLE_USER_HOME`), add `DUSK_ANDROID_MAPS_API_KEY=your_restricted_key`. Alternatively, supply an environment variable with the same name before launching Gradle. Do not paste the key into chat, commit it, or pass it on a command line. Gradle injects the value into the APK manifest. The JavaScript bridge receives only a configured/unconfigured boolean. The APK contains the restricted key, so protect it with package, certificate, and API restrictions.
4. Open Android Studio with `npm run native:open:android`, sync Gradle, and **Run** the app again on the Pixel emulator. A web sync alone does not refresh a key in an existing APK. Open **Map** and verify live tiles, pan/pinch, fictional marker taps opening the existing details, search/category/city/Saved-only marker changes, rotation, and tab switching. A fictional venue must never offer directions. If tiles are blank, confirm package, signing SHA-1, API enablement, billing, connectivity, and Play services. Inspect local diagnostics without sharing credential values.

Without a key or after a detected initialization error, Map shows a status and the list remains usable. If the SDK creates its view but cannot fetch tiles, it may leave a blank map without reporting an initialization error to Capacitor. The matching venue list remains below it. iOS still uses the no-key fallback. The shared native component and plugin can be reused after adding an iOS-only configuration adapter and verifying the Xcode build with an iOS-restricted key. The website still uses the existing browser SDK. [Google Maps key guidance](https://developers.google.com/maps/api-security-best-practices)

## Native device checklist

- Confirm the app opens without a dev server and the fictional previews stay labeled, including in details. Try airplane mode and verify the venue list and local image fallback.
- Check portrait and landscape, system bars and safe areas, category swipes, search keyboard, and the detail modal. On Android, test system Back from Map, Saved, and a detail modal. On iOS, verify navigation after suspend/resume.
- Save a venue, force-close and reopen the app, and confirm the save persists. Browser and native saves use separate storage.
- Open Map in a build without a key and verify the explanation and usable list. Test the configured Android flow separately. There should be no native location permission prompt. Use the [physical-device Maps checklist](google-maps.md#physical-device-checklist) for the authorized HTTPS browser preview. Current demo details expose no directions link.

Android and iOS projects were generated with the Capacitor CLI on Windows. The native launcher and splash art are the generated defaults and can be replaced with approved DUSK assets before investor distribution.
