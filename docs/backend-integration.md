# Local customer integration — Phase 6B.4

This milestone is local and synthetic. It creates no hosted project and enables no real venue, promotion, payment, or redemption. No database schema migration is required. Existing RLS, MFA gates, approval, verification, immutable history, and release controls are preserved. Local email signup is now enabled with confirmation required. Mail stays in the local test-mail service.

## Application boundary

Demo mode is the default. It uses the existing bundled catalog, Google Maps integration, market preferences, and local Saved IDs. Backend mode is an explicit build/development configuration. It reads only `api.public_venues` and `api.public_offers`, never internal or staff feeds. Empty results stay empty. Failure clears listings and offers retry; there is no automatic demo fallback. Switching modes requires restarting/rebuilding, so catalogs and Saved namespaces cannot mix.

The typed public API contract lives in `src/backend/database.ts`. The adapter reuses `RealVenue`, `Offer`, stable market IDs, catalog validation, and schedule validation. It validates offers but does not add a real-offer presentation or redemption flow. The existing real-venue discovery interface handles public venue results. Public release remains disabled and the synthetic seed venues remain invisible. A 200-row result fails closed rather than silently truncating a pilot catalog. Pagination is deferred.

Public data refreshes on explicit retry, foreground/focus, and every minute while foregrounded. Each refresh clears old listings first. Backend eligibility withdrawal is immediate on the next query; an already-open client can show its last response for up to the refresh interval. Offline/failed refreshes clear it. This is not sufficient for future transactional redemption, which must authorize again on the server.

Supabase SDK 2.119.2 is pinned. The client uses only a publishable key or legacy anon key and the exposed `api` schema. Public build configuration is validated before Vite serves/builds it. Hosted endpoints, secret keys, non-anon JWTs, and database URLs are rejected. Runtime validation also fails closed. The asset scanner checks common credential patterns; it cannot prove absence of arbitrary secrets, so configuration review remains necessary. Never put privileged values in any public-prefixed environment variable.

## Customer authentication and sessions

The local account panel supports email/password registration, email-code verification, login, local logout, recovery-code verification, and password replacement. Only email/password are sent at registration. No customer-controlled role or privileged metadata is sent. Auth confirmation and database authorization remain server responsibilities. `ensure_account` creates a stable ordinary account identity after server identity validation. Privileged operations still require existing database membership/admin checks and MFA.

Confirmation/recovery templates display codes rather than credential-bearing links. Enter the code in the app and select its purpose. URL session detection is disabled. No custom-scheme intent filter, token URL parser, external callback, or open redirect is introduced. Production universal/app links, domain ownership, callback allowlists, and OS verification need a separate review before OAuth or link-based flows.

Web sessions use `sessionStorage`, scoped to a tab. Reload in the same tab restores/refreshes the session. Closing the tab ends persistence; duplicated tabs may inherit a browser copy. This is accessible to JavaScript and vulnerable to XSS. Do not treat it as secure credential storage. Keep the SDK/current dependencies patched, avoid unsafe HTML, and add a tested production CSP and hosting security headers before deployment. The app renders backend strings as React text.

Native sessions use a per-client memory adapter. Neither localStorage nor Capacitor Preferences stores tokens. Refresh and focus/visibility restoration work while the process lives. Process death or a WebView reload requires login again. This intentionally defers durable native sign-in until a maintained Android Keystore-backed solution, backup behavior, device lock expectations, and lifecycle/device tests are approved. No iOS backend integration is authorized or enabled by this Android workflow.

The SDK rotates refresh tokens. Foregrounding resumes refresh; backgrounding stops it. Identity is checked through Auth before the ordinary account RPC. UI identity is never an authorization boundary. Logout uses the pinned SDK's `local` scope, which removes local credentials before attempting server revocation. Network failure may leave an already-issued access JWT usable until expiry (15 minutes locally); refresh revocation cannot be guaranteed offline. Signing out does not erase local Saved venues or market preferences. Cross-device logout and remote-device session management are deferred.

Account deletion is not implemented. Auth identity, stable application identity, and immutable audit evidence need an approved deletion/anonymization and retention policy. A future authenticated operation must require recent identity verification, revoke sessions, deactivate the account, and delete/anonymize approved data while preserving legally required records. In-app account deletion and applicable store/web deletion entry points must be addressed before customer distribution. This local synthetic panel must not be shipped as production account support. Do not collect real customer data.

## Windows update and web test

Start Docker Desktop. In normal PowerShell:

```powershell
Set-Location 'C:\Users\gcout\Documents\Dusk App, LLC\App Developement\dusk-app-phase6a'
git status --short
git fetch origin
git switch feat/dusk-nightlife-app
git pull --ff-only origin feat/dusk-nightlife-app
npm ci
npm run backend:start
npm run backend:status
```

Preserve any unrelated changes before pulling. Leave the Android configuration stash stored. Do not run `backend:reset` against your retained database. Starting updates the local Auth configuration/templates without a schema reset. If the pinned runtime requests a restart, stop/start this checkout's stack. Never bypass the firewall guard.

Generate optional untracked local configuration using **only** the public client key. Run this in the repository root. It refuses to overwrite either file and never prints keys:

```powershell
node scripts/configure-local-client.mjs
```

This writes `.env.backend.local` for the browser and `.env.native-local.local` for the explicit Android test build. Default web/demo and default native builds do not consume these mode-specific files. Neither file contains a privileged key. The script reads CLI status in memory and checks the fixed local endpoint.

Run the browser local-backend mode:

```powershell
npm run dev -- --mode backend --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173`. Local mail is `http://127.0.0.1:55324`; Studio is port 55323. Use unique `@example.invalid` identities. Default anonymous demo mode is `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` after stopping the other server. Do not use public tunnels or forwarded ports.

## Android emulator test only

The default `native:sync:android` still creates the original demo experience and strips the backend module/endpoints. The separate local workflow uses a localhost HTTP WebView origin with a debug-only network-security resource permitting cleartext to `localhost` and `127.0.0.1` only. Other cleartext traffic stays denied. HTTPS certificate validation is unchanged. Neither the main/release manifest nor Maps credentials are changed. Gradle rejects release tasks if copied assets/config contain the local backend marker, endpoint, or HTTP origin. Restore a normal demo sync before any release build.

Start the Pixel 8 from Android Studio and unlock it. In normal PowerShell:

```powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adb devices
```

Proceed only when exactly the intended emulator is listed as `device`. If `unauthorized`, complete normal ADB authorization on the emulator/host. Do not disable ADB authentication or alter trust stores. Substitute its serial below if different:

```powershell
& $adb -s emulator-5554 reverse tcp:55321 tcp:55321
& $adb -s emulator-5554 reverse --list
npm run native:sync:android:local
$env:JAVA_HOME = Join-Path $env:USERPROFILE '.jdks\jbr-21.0.11'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
Push-Location android
.\gradlew.bat installDebug
Pop-Location
```

ADB reverse forwards only the API port to the host's existing loopback endpoint; it does not open the host firewall or expose Studio/mail/database ports to the emulator. Debug transport is plaintext over the trusted local ADB channel, unsuitable for real users. No public tunnel or `10.0.2.2` firewall exception is used. Native sessions are memory-only. Never distribute this debug APK. Keep the existing restricted Maps key in its existing user Gradle configuration.

After testing:

```powershell
& $adb -s emulator-5554 reverse --remove tcp:55321
npm run native:sync:android
npm run backend:stop
```

Default sync uses the prior HTTPS WebView origin. Native local mode's HTTP origin has separate local storage; existing demo Saved data remains in its prior origin. This origin separation is specific to emulator testing and is not a Saved migration.

The JDK path above is the existing JDK 21 found on this founder machine. Verify it exists before using it elsewhere. Android Studio's bundled JDK 25 is incompatible with the current Gradle 8.14.3; do not change the Gradle version or global Java configuration to work around that. These environment assignments affect only the current PowerShell process.

## Manual acceptance

1. In default demo mode verify Las Vegas, Atlantic City, NYC, search/categories, Maps selection, Saved persistence, navigation, and fictional disclaimers. Verify it works with Supabase stopped.
2. Start Supabase and explicit backend web mode. Confirm the mode label, empty public feed, and absence of synthetic internal venues. Anonymous browsing must work without opening the account panel.
3. Register a unique synthetic email with a password of at least 12 characters. Login must fail before confirmation. Read its code in local mail, select Email verification, and verify. Confirm customer sign-in; no staff/admin controls should appear.
4. Reload the same web tab and confirm session restoration. Sign out, reload, and confirm no session. Saved demo spots and market preference must remain intact.
5. Request password recovery, read the new local-mail code, select Password recovery, verify, and set a new password. Confirm the old password fails and the new one works.
6. Stop the backend. Refresh backend discovery. Confirm no demo substitution and a clear retry/error state. Sign out offline and reload; local sign-in state must be gone. Restart and retry.
7. For Android, first confirm authorized ADB and reverse mapping. Install only the debug local build. Repeat synthetic login/recovery, background/resume, rotate, then force-stop/reopen. Expect native sign-in to end after process/reload; test Maps separately with its existing configuration.
8. Remove the reverse mapping and restore default demo sync. Confirm Maps and previously saved demo spots. Do not distribute, merge, or deploy.

## Automated checks

```powershell
npm test -- --maxWorkers=2
npm run build
npm run build:check
npm run test:e2e -- --workers=2
npm run build:native
node scripts/check-public-build.mjs dist --native
npm run backend:test
npm run backend:test:api
npm run backend:test:customer
npm run backend:test:network
```

Backend tests target the fixed local stack and use synthetic identities. Customer tests use real public Auth signup, local test-mail codes, ordinary sessions, restoration/refresh/logout/recovery, and public/private access checks. Only cleanup uses administrative credentials in memory. They never reset a database. Test accounts are removed and application identity records deactivated; pseudonymous history can remain until an explicitly authorized disposable reset. Security tests and CI do not prove external network isolation. Do not change firewall rules for connectivity troubleshooting.

## Verification boundaries for this implementation

The Windows application/component and Chromium suites ran locally. Initial high-concurrency runs hit worker/test timeouts; reduced-concurrency reruns passed. The Windows firewall guard mocks passed. Actual database rebuild, all 78 database assertions, the existing seven Auth/API scenarios plus parent, and six customer Auth scenarios plus parent passed against a disposable Supabase stack in GitHub Actions. Web/native builds and public asset scans also ran in CI.

The local Windows Docker engine/experimental stack owner timed out, so these real Auth/database suites could not be repeated in this Windows session. The founder's retained database was never reset. The Pixel 8 reported unauthorized through host ADB, so no reverse mapping, native backend request, or live native authentication was verified. Native lifecycle behavior and Maps still require the manual emulator checklist. Do not treat browser mocks or CI Auth tests as proof of Android connectivity or external firewall isolation.

Both the normal demo and explicit local-test Android debug APKs compiled successfully using the existing JDK 21. The local-test APK used a synthetic build-only public key and was not installed. A release task dry run correctly rejected the local-test assets. The normal native asset scan passed with no local backend endpoint. These are build checks, not native network or device checks.
