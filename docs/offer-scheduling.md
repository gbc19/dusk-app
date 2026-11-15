# Offer data and scheduling

Phase 2 adds pure offer rules. The six existing deals are display-only fixtures with stable `demo:` offer IDs, sample hours, and their original numeric saved IDs. Their sample words and hours do not drive a live schedule. There is no public offer feed or promotion UI.

## Lifecycle and validation

An offer has a stable ID, venue ID, positive integer revision, title, description, eligible product, exact terms, and a positive integer price in USD cents. Optional per-customer and per-occurrence limits and inventory are configuration only. The catalog accepts one current revision per ID. The `demo:` prefix is reserved for fictional offers, which require a demo venue, preview publication, and no applicable approval.

A future real offer starts as a draft. Review the exact revision, venue, market, product, price, advertising, and terms before any decision to publish. Keep evidence in a separate private record keyed by offer ID and revision. Material edits require a new revision and review. The venue-specific management workflow would check staff assignments, record publication decisions, and allow immediate suspension. Revocation should suspend or unpublish the record. The domain scheduling predicate returns false for a revoked, suspended, unpublished, unapproved, or demo offer.

`validateOfferCatalog` checks data shape, known venue references, matching demo identity and venue time zone, schedule bounds, pricing, and state consistency. Its future public mode also requires a published real venue and a published, approved real offer. Strict public-shaped records exclude approval evidence. The approved flag is a data value. A future private publication workflow must independently verify evidence for the exact revision before allowing any public use.

## Calendar rules

- `matchesOfferSchedule` evaluates an explicit instant in the venue's IANA zone. Local dates use `YYYY-MM-DD` and times use 24-hour `HH:mm`. The first date and each window's start are inclusive. The final date and each window's end are exclusive.
- A window ending earlier than it starts runs overnight and belongs to the weekday it starts on. Equal start and end times are invalid. An overnight tail cannot extend outside the offer date range.
- Date exceptions replace windows **starting** on that date. An empty exception cancels those starts, including their next-day tails. It does not cancel a tail that started on the previous date.
- The clock uses local wall time. Spring-forward minutes that do not exist never match. Both fall-back occurrences of a repeated minute can match. This phase evaluates instants and does not define inventory accounting across repeated hours.
- `isOfferScheduled` adds publication and approval-state gates to the calendar calculation. Neither function determines legal authorization, eligibility, stock availability, or redeemability.

## Future claim and redemption concept

Only after legal and venue approval, a trusted server could evaluate a claim against the approved revision, server time, venue, eligibility rules, and available inventory. It would enforce limits and inventory atomically and make retries idempotent. Redemption would require a venue-scoped staff check, a single-use claim reference, and a minimal audit trail. Venue staff would retain control over age verification and lawful service. No part of this workflow is implemented in Phase 2.
