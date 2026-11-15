# DUSK data model foundation

## MVP boundary

This is a TypeScript design contract, not a database migration. Only fictional venues and their offers are instantiated. Customer, staff, and venue assignment interfaces have no records, collection endpoints, sign-in, or storage. Anonymous browsing and device-local saved deal IDs continue as before.

`src/domain/features.ts` fixes promoter profiles, nightlife events, guest lists, and table reservations to `false`. There are no routes, screens, API handlers, background jobs, vendors, or paid dependencies for those features. The flags document the boundary; they are not authorization controls. A later feature needs a separate implementation and explicit enablement, not just a flag change.

## Core entities

| Entity               | Fields                                                                                                            | Relationship / purpose                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Venue                | Stable ID, name, market/city, neighborhood, IANA time zone, venue category, and explicit demo or real status | Demo rows have `preview` state and a fictional pin. Real rows have `draft`, `verified`, `published`, or `suspended` state, a street address required for verification/publication, and optional independently verified coordinates. |
| VenueVerification    | Venue ID, reviewer, review date, address source, and a coordinate source when coordinates are present | Private publication input, excluded from the public catalog. |
| Deal                 | Existing numeric ID, venue reference, offer category, copy, sample hours, image, and tag | Preview offers can reference demo venues only. The UI uses the same venue record for cards, pins, and details. |
| Customer             | `id`, `displayName`, `status`                                                                                     | Minimal private customer profile; no accounts are created in this version.                              |
| Staff                | `id`, `displayName`, `status`                                                                                     | Minimal private staff profile, separate from a customer's public-facing identity.                       |
| VenueStaffAssignment | `venueId`, `staffId`, `role`, `status`                                                                            | Many-to-many venue membership; `manager` or `staff` role scoped to one venue.                           |

IDs are opaque, stable strings except for existing numeric deal IDs, retained to preserve local saved spots. Do not derive IDs from names, emails, or array positions in production. Fixtures use explicit IDs. Do not embed customer lists, staff lists, reservations, or event arrays inside venue records.

A future persistence layer must enforce referenced record existence and uniqueness of `(venueId, staffId)`. Removing an assignment must not delete a person's profile. Deactivate core records with history rather than cascading deletion into future bookings. Venue publication authorizes directory visibility only. Live promotions would require separate review and approval.

## Introducing verified venues

1. Assign each real venue a new, permanent ID. Confirm the name, market, category, address, and time zone with an authorized venue contact. Keep the source and reviewer in a private verification record. Verify coordinates independently before attaching them.
2. Use `validateCatalog` to check unique and nonempty IDs, preview offer references, required fields, supported market/category, IANA time zone, publication/verification consistency, and coordinate bounds. Select only records approved for publication and pass them with their private reviews to `exportPublicCatalog` in a private workflow. The export rejects demo and unpublished rows and emits only allowlisted public fields.
3. Supply that public output to the app's public catalog input. The runtime import checks the full batch against the publication rules and public field allowlist. A malformed row, duplicate ID, or unexpected field (including private review data) produces an empty real-mode catalog. The published status records the private workflow's approval decision. The browser does not independently verify its provenance. The default entry point still loads the fictional preview. A published real venue with an address can appear in the list without coordinates. A pin and directions require the same verified coordinates. Suspension removes eligibility for all three. Demo pins remain available only in the preview and never enable directions.

Existing preview saves retain their numeric IDs. Unknown or obsolete IDs are ignored. Real venue saves use stable venue IDs and separate local storage.

Staff roles are design vocabulary, not implemented permissions. When adding a backend, check both staff and assignment status server-side for the requested venue; never trust client flags or role strings. If a person is both customer and staff, keep those profiles separate and link them through a private authentication identity later. Do not introduce an auth provider or universal user/role framework now.

## Future extensions — design only, disabled

These are relationship sketches, not implemented interfaces or storage tables. Final fields and states should be decided with each feature's actual requirements.

DUSK may later support venue-based, opt-in dating or social discovery. Stable venue IDs can identify the venue for those features. This phase adds no dating, profiles, location verification, or social functionality.

| Extension               | Proposed minimum fields / references                                                        | Design boundary                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PromoterProfile         | `id`, public `displayName`, private identity link                                           | Separate public promoter profile from customer/staff records. A promoter need not be venue staff.                                                                                 |
| VenuePromoterAssignment | `venueId`, `promoterId`, `status`                                                           | Explicit venue affiliation; never infer staff privileges from promotion work.                                                                                                     |
| NightlifeEvent          | `id`, `venueId`, title, `startsAt`, `endsAt`, status                                        | One venue per initial event. Optional event/promoter join records if multiple promoters are needed. Store UTC instants and use venue IANA time zone for display.                  |
| GuestList               | `id`, `eventId`, name, optional capacity                                                    | Event-scoped list. Later entries reference `guestListId`, `customerId`, party size, and status; use a uniqueness rule per customer/list and define plus-one policy before launch. |
| VenueTable              | `id`, `venueId`, label, capacity, status                                                    | Venue-specific inventory, added only when reservations are implemented.                                                                                                           |
| TableReservation        | `id`, `tableId`, `customerId`, optional `eventId`, `startsAt`, `endsAt`, party size, status | Table resolves its venue; optional event must belong to that venue. Supports event and non-event reservations.                                                                    |

For future booking, validate time order, positive party size, table capacity, event/venue consistency, and permitted transitions on the server. Prevent overlapping confirmed reservations and guest-list capacity overruns atomically in the chosen database. Add request idempotency when writes exist. None of that infrastructure belongs in the discovery MVP.

## Data and cost discipline

- Keep venue discovery data separate from private customer and staff records. Do not ship private records in frontend bundles.
- Do not collect email, phone, birth date, identity documents, payment details, or guest names in anticipation of a future feature. Define purpose, access, and retention when a feature needs them. Profile existence is not proof of age or verification.
- Keep current local saved spots anonymous. If accounts are added, design an explicit opt-in migration rather than silently linking device history to a person.
- Add verified street addresses/coordinates with real venue onboarding; explicitly labeled fictional demo coordinates are used for preview markers only. Directions require an explicitly real venue and a separate verified location; demo pins never qualify. No geocoding is performed.
- No ORM, hosted database, authentication service, booking vendor, billing system, analytics, or new dependency is needed for these contracts.
- Do not build a generic metadata bag, permissions engine, event bus, repository abstraction, or speculative schema migrations. Add concrete fields and constraints incrementally.

## Verification

TypeScript checks the domain contracts and venue/offer integration. Existing UI tests cover filtering, saving, city selection, and venue details. Data integrity checks ensure fixture IDs are unique and offers reference preview venues. No test or dependency requires a paid service.
