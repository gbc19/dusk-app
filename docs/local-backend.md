# Local backend foundation

Phase 6B.3 adds an isolated Supabase/PostgreSQL foundation. The React application continues to load its bundled fictional catalog independently. Browser and native maps, saved spots, market selection, and Maps credentials retain their existing implementation.

The CLI is pinned to 3.4.0. Its experimental stack runtime provides directory/branch/name isolation and explicit Docker port bindings. The service lockfile pins resolved runtime artifacts, including PostgreSQL 17.11.0.006. Review CLI and image upgrades together. The runtime remains experimental and requires regression testing when upgraded.

The named stack is `foundation`. The project reference is `dusk-foundation-local`. Its local data is scoped to the checkout directory, Git branch, and stack name. The founder's checkout and Codex's isolated checkout have separate local data. A hosted account, project link, or production credential is unnecessary.

## Windows network protection

Testing found that the CLI's Windows host gateways listen on wildcard addresses even when Docker service ports bind to loopback. `backend:start` therefore checks Windows Firewall before starting. A DUSK-specific block rule prevents non-loopback inbound TCP connections on ports 55321–55324. Startup also checks actual Docker port bindings and stops the stack if those bindings are unexpected.

The installer adds one named rule scoped to those four ports. It does not modify existing rules. Run the installer explicitly once from Administrator PowerShell. Normal backend commands run without administrator privileges. The firewall check fails closed if the rule is absent, altered, or a firewall profile is disabled. Its execution-policy setting applies only to the child PowerShell process.

The Linux CI job runs on an isolated disposable GitHub runner. Other local operating systems require their own reviewed host-network protection before this wrapper permits startup. Keep the development services off public port forwarding. Local Studio has database-owner capabilities and relies on local access protection.

## Founder update and first run

Open normal PowerShell in the existing Git checkout. Preserve any unrelated changes before pulling. The existing Android configuration stash can remain stored.

```powershell
Set-Location 'C:\Users\gcout\Documents\Dusk App, LLC\App Developement\dusk-app-phase6a'
git status --short
git fetch origin
git switch feat/dusk-nightlife-app
git pull --ff-only origin feat/dusk-nightlife-app
npm ci
```

Start Docker Desktop and wait for its engine to be ready. The npm wrapper detects the per-user Docker executable if it is absent from PATH.

Open **PowerShell as Administrator** for this one-time, port-scoped firewall step. Review the script before running it.

```powershell
Set-Location 'C:\Users\gcout\Documents\Dusk App, LLC\App Developement\dusk-app-phase6a'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-local-backend-firewall.ps1
```

Return to normal PowerShell in that checkout.

```powershell
npm run backend:start
npm run backend:status
npm run backend:test
npm run backend:test:api
npm run backend:test:network
```

The initial start applies migrations and synthetic seeds. Image downloads can take several minutes. Studio is available at `http://127.0.0.1:55323`, the API at `http://127.0.0.1:55321`, and test mail at `http://127.0.0.1:55324`. Anonymous Auth accounts are disabled. Phase 6B.4 enables local synthetic email signup with confirmation codes; see [application integration](backend-integration.md). Privileged security-test fixtures still use ordinary Auth sessions and real TOTP factors after administrative setup.

To rebuild **this disposable local backend**, replacing its database contents with migrations and synthetic seeds, run:

```powershell
npm run backend:reset
npm run backend:test
npm run backend:test:api
```

The reset wrapper fixes the local target, verifies its stack identity and local release-control record, and rejects additional command-line flags. Stop the local backend while retaining its data with:

```powershell
npm run backend:stop
```

The existing app can still be checked independently:

```powershell
npm test
npm run build
npm run build:native
npm run test:e2e -- --workers=2
```

## Schema and controlled operations

`20261124000100_foundation.sql` creates the twelve tables, keys, constraints, indexes, schedule validation, calendar predicates, immutable-record triggers, and closed default privileges.

`20261124000200_security_operations.sql` adds current-account and venue-scoped authorization, RLS read policies, allowlisted API views, profile operations, memberships, venue verification, revision creation/submission/review, suspension, and guarded publication.

`20261124000300_validation_and_account_controls.sql` validates market time zones and adds administrator-only account deactivation and private verification retrieval.

| Schema | Records | Access boundary |
| --- | --- | --- |
| app | markets, accounts, venues, venue_memberships, offers, offer_revisions | RLS and read grants, with writes through controlled operations |
| private | licensing_jurisdictions, dusk_admins, venue_verifications, offer_reviews, audit_events, release_controls | Closed tables, narrow authorized helpers and operations |
| api | public and account-scoped views, controlled RPCs | The only REST-exposed schema |

Application IDs are generated UUIDs. Offer revisions have composite `(offer_id, revision_no)` keys and request IDs for safe retries. The published-revision FK enforces that the revision belongs to the offer. Reference markets preserve the existing stable market IDs. Bundled fictional venue IDs remain in the frontend catalog.

Customers read their own account. Employees read assigned venue information. Managers with MFA create, submit, and pause offers for assigned venues. DUSK administrators with MFA manage memberships, verification, account status, and revision decisions. Administrator grants, jurisdiction authorization, and release enablement have no application RPC. A trusted local database owner can provision synthetic grants for tests.

Security-definer functions use empty search paths, qualified relations, explicit identity checks, and restricted execution grants. Memberships and account status are looked up for each operation. Venue and offer row locks serialize saves and transitions. Authorization is checked again after acquiring managed-offer locks. Changes and audit events commit together.

Venue identity and demo classification are immutable. Material venue changes increment verification versions and remove publication status. Verification, offer revision, review, and audit records reject updates/deletes. Review transitions require a submitted exact revision. A revoked revision requires a new revision and review.

Public eligibility is evaluated on every query, including for previously published rows. It checks release controls, real identity, venue status, enabled market, jurisdiction authorization, unexpired verification for the current venue version, exact published revision, and current approval. Suspension, revocation, expiry, or verification invalidation removes visibility immediately. Cached clients will eventually need explicit refresh/staleness handling when backend integration is approved.

Schedules are strict JSONB documents matching the existing IANA-zone, local-date, start-inclusive/end-exclusive, overnight, date-exception, and DST semantics. Optional positive limits are configuration only. The public offer view is a publication feed. It grants no claim, inventory, service, age-verification, or redemption authority. Overlapping windows retain the existing domain behavior and require an occurrence policy before transactional redemption.

The seed creates three reference markets, one explicitly synthetic licensing authority, and two synthetic demo venues. Public feeds remain empty because release controls default to disabled. Positive publication tests temporarily simulate real-shaped synthetic records and authorizations inside rollback-only transactions. These changes never persist or reach the app.

## Security testing and local configuration

Database tests exercise constraints, RLS under ordinary roles, cross-account/cross-venue isolation, MFA gates, immutable history, retry behavior, and immediate publication withdrawal. The API suite obtains ordinary local Auth tokens, enrolls/verifies TOTP factors, tests concurrent saves, and checks revocation using existing sessions. Only fixture setup and cleanup use local administrative credentials.

API tests remove synthetic Auth users and scrub their account names. Pseudonymous inactive account/audit/offer history remains in the disposable database until reset. Final production retention and release authorization remain deferred.

The network guard has mocked PowerShell tests for expected protection, missing rules, incorrect action/scope, and disabled firewall profiles. Installing the real Windows rule requires administrator privileges and must be checked on the founder's machine. Codex could validate the rejection path and mocks, but could not install the rule in its non-administrator session.

No environment values are needed by the app in this milestone. `supabase/.env.example` lists optional local-only configuration names. Keep actual values untracked. Tests obtain keys from the fixed local CLI status in memory. The npm status command avoids printing keys. Never put a secret key into `VITE_` or `DUSK_NATIVE_PUBLIC_` variables or paste raw CLI credential output into issues.

Stopping retains local data. Migrations and seeds reconstruct synthetic environments. Any future manual records need an encrypted backup before a reset, directory move, or runtime upgrade. Database dumps exclude uploaded files. Storage is disabled here. Hosted setup, production backups, customer authentication screens, venue management screens, and all deferred feature modules require separate authorization.
