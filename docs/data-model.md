# DUSK data model foundation

## MVP boundary

This is a TypeScript design contract, not a database migration. Only fictional venues and their offers are instantiated. Customer, staff, and venue assignment interfaces have no records, collection endpoints, sign-in, or storage. Anonymous browsing and device-local saved deal IDs continue as before.

`src/domain/features.ts` fixes promoter profiles, nightlife events, guest lists, and table reservations to `false`. There are no routes, screens, API handlers, background jobs, vendors, or paid dependencies for those features. The flags document the boundary; they are not authorization controls. A later feature needs a separate implementation and explicit enablement, not just a flag change.

## Core entities

| Entity               | Fields                                                                                         | Relationship / purpose                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Venue                | `id`, `name`, `city`, `neighborhood`, `timeZone`, `status`, `demoLocation`                     | Stable venue identity shared by offers and later experiences. Current records are `preview`.            |
| Deal                 | Existing numeric `id`, `venueId`, category, offer copy, description, display hours, image, tag | Many offers can reference one venue. Venue name and location are joined into the current flat UI model. |
| Customer             | `id`, `displayName`, `status`                                                                  | Minimal private customer profile; no accounts are created in this version.                              |
| Staff                | `id`, `displayName`, `status`                                                                  | Minimal private staff profile, separate from a customer's public-facing identity.                       |
| VenueStaffAssignment | `venueId`, `staffId`, `role`, `status`                                                         | Many-to-many venue membership; `manager` or `staff` role scoped to one venue.                           |

IDs are opaque, stable strings except for existing numeric deal IDs, retained to preserve local saved spots. Do not derive IDs from names, emails, or array positions in production. Fixtures use explicit IDs. Do not embed customer lists, staff lists, reservations, or event arrays inside venue records.

A future persistence layer must enforce referenced record existence and uniqueness of `(venueId, staffId)`. Removing an assignment must not delete a person's profile. Deactivate core records with history rather than cascading deletion into future bookings. `active` indicates operational status only; it never authorizes an alcohol promotion. Regulatory approval will need its own scoped, verified model before live offers.

Staff roles are design vocabulary, not implemented permissions. When adding a backend, check both staff and assignment status server-side for the requested venue; never trust client flags or role strings. If a person is both customer and staff, keep those profiles separate and link them through a private authentication identity later. Do not introduce an auth provider or universal user/role framework now.

## Future extensions — design only, disabled

These are relationship sketches, not implemented interfaces or storage tables. Final fields and states should be decided with each feature's actual requirements.

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
- Add verified street addresses/coordinates with real venue onboarding; explicitly labeled fictional demo coordinates are used for preview markers and directions. No geocoding is performed.
- No ORM, hosted database, authentication service, booking vendor, billing system, analytics, or new dependency is needed for these contracts.
- Do not build a generic metadata bag, permissions engine, event bus, repository abstraction, or speculative schema migrations. Add concrete fields and constraints incrementally.

## Verification

TypeScript checks the domain contracts and venue/offer integration. Existing UI tests cover filtering, saving, city selection, and venue details. Data integrity checks ensure fixture IDs are unique and offers reference preview venues. No test or dependency requires a paid service.
