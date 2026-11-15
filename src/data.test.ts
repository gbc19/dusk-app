import { expect, test } from "vitest";
import { deals, filterDeals, knownSavedIds, realVenueListings, venues } from "./data";
import { exportPublicCatalog, validateCatalog, venueMapPosition } from "./domain/catalog";
import type { RealVenue, Venue } from "./domain/models";

const real: RealVenue = {
  id: "real-test",
  isDemo: false,
  status: "published",
  category: "bar",
  name: "Synthetic venue",
  city: "Atlantic City",
  neighborhood: "Test neighborhood",
  address: "Test address",
  timeZone: "America/New_York",
};
const review = { venueId: real.id, reviewedBy: "Reviewer", reviewedAt: "2026-01-01", source: "Private test source" };

test("preview offers retain their saved IDs and use the original venue records", () => {
  expect(deals.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(deals.map(({ offerId }) => offerId)).toEqual([
    "demo:1", "demo:2", "demo:3", "demo:4", "demo:5", "demo:6",
  ]);
  expect(deals.every(({ isDemo }) => isDemo)).toBe(true);
  expect(deals.map(({ venue }) => venue)).toEqual(venues);
  expect(knownSavedIds([2, 999, "2", null, 2, 6])).toEqual([2, 6]);
  expect(validateCatalog(venues)).toEqual([]);
  for (const venue of venues) expect(venueMapPosition(venue)).toBe(venue.demoLocation);
});

test("published venues can be listed without a pin; unpublished venues stay hidden", () => {
  const mapped: RealVenue = {
    ...real,
    id: "mapped",
    verifiedLocation: { lat: 40, lng: -74, verified: true },
  };
  const catalog = realVenueListings([
    real, mapped,
  ]);
  expect(filterDeals("Atlantic City", "All spots", "", false, [], catalog).map(({ id }) => id))
    .toEqual([real.id, mapped.id]);
  expect(venueMapPosition(real)).toBeNull();
  expect(venueMapPosition(mapped)).toBe(mapped.verifiedLocation);
  expect(venueMapPosition({ ...mapped, status: "suspended" })).toBeNull();
});

test.each([
  null, {}, [null], [{ ...real, id: "" }], [real, real],
  [venues[0]], [{ ...real, status: "suspended" }], [{ ...real, status: "active" }],
  [{ ...real, address: "" }], [{ ...real, timeZone: 123 }],
  [{ ...real, verifiedLocation: { lat: 91, lng: -74, verified: true } }],
  [{ ...real, verifiedLocation: { lat: 40, lng: -74, verified: false } }],
  [{ ...real, verifiedLocation: { lat: 40, lng: -74, verified: true, source: "private" } }],
  [{ ...real, verification: review }], [{ ...real, venueId: "unresolved" }],
].map((input) => ({ input })))("invalid public input fails closed %#", ({ input }) => {
  expect(realVenueListings(input)).toEqual([]);
});

test("validation rejects bad IDs, references, publication fields and location claims", () => {
  expect(validateCatalog([
    real, real, { ...real, id: "", timeZone: "invalid", address: "" },
    { ...real, id: "bad-coordinates", verifiedLocation: { lat: 91, lng: -74, verified: true } },
    { ...real, id: "draft", status: "draft", verifiedLocation: { lat: 40, lng: -74, verified: true } },
    { ...venues[0], verifiedLocation: { lat: 40, lng: -74, verified: true } } as unknown as Venue,
  ], [{ venueId: "missing" }, { venueId: real.id }])).toEqual([
    "real-test: duplicate venue ID",
    "(missing ID): missing or malformed venue ID",
    "(missing ID): missing or invalid venue fields",
    "(missing ID): missing verified address",
    "bad-coordinates: invalid verified coordinates",
    "draft: inconsistent real status or verification",
    "venue-1: inconsistent demo status or verification",
    "Unknown venue reference: missing",
    "Preview offer references real venue: real-test",
  ]);
});

test("public export rejects demo and unpublished rows and allowlists fields with private review", () => {
  expect(() => exportPublicCatalog([venues[0]], [])).toThrow("demo venue in public catalog");
  expect(() => exportPublicCatalog([{ ...real, status: "verified" }], [review])).toThrow("unpublished venue");
  expect(() => exportPublicCatalog([real], [])).toThrow("private verification");
  expect(() => exportPublicCatalog([real], [review, review])).toThrow("private verification");
  const row = { ...real, verification: review };
  expect(exportPublicCatalog([row], [review])).toEqual([real]);
  const mapped = { ...real, verifiedLocation: { lat: 40, lng: -74, verified: true } } as const;
  expect(() => exportPublicCatalog([mapped], [review])).toThrow("coordinate verification source");
  expect(exportPublicCatalog([mapped], [{ ...review, coordinateSource: "Private evidence" }]))
    .toEqual([mapped]);
  expect(realVenueListings(exportPublicCatalog([row], [review])))
    .toEqual([{ id: real.id, venue: real }]);
});
