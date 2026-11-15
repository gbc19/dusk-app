import { expect, test } from "vitest";
import { deals, venues } from "../data";
import type { RealVenue } from "./models";
import { isOfferScheduled, matchesOfferSchedule, validateOfferCatalog, type Offer, type OfferSchedule } from "./offers";

const venue: RealVenue = {
  id: "synthetic-venue", isDemo: false, status: "published", category: "bar",
  name: "Test venue", city: "Atlantic City", neighborhood: "Test district",
  timeZone: "America/New_York", address: "100 Test Street",
};
const schedule: OfferSchedule = {
  timeZone: venue.timeZone,
  startsOn: "2026-01-02",
  endsBefore: "2026-01-10",
  weekly: [{ day: "Fri", start: "22:00", end: "02:00" }],
};
const offer = {
  id: "synthetic-offer", venueId: venue.id, revision: 1, isDemo: false,
  publication: "published", approval: "approved",
  title: "Synthetic promotion", description: "Schedule test only", product: "Test drink",
  terms: "Test terms only", priceCents: 100, currency: "USD", schedule,
  limits: { perCustomer: 1 }, inventory: { unitsPerOccurrence: 10 },
} satisfies Offer;

test.each([
  ["2026-01-03T02:59:59.999Z", false],
  ["2026-01-03T03:00:00Z", true],
  ["2026-01-03T06:59:59.999Z", true],
  ["2026-01-03T07:00:00Z", false],
  ["2026-01-04T03:00:00Z", false],
  ["2026-01-10T04:59:59.999Z", true],
  ["2026-01-10T05:00:00Z", false],
] as const)("overnight schedule at %s is %s", (instant, expected) => {
  expect(isOfferScheduled(offer, new Date(instant))).toBe(expected);
});

test("the first date cannot inherit an overnight window and exceptions replace their service date", () => {
  const startsFriday = { ...schedule, weekly: [{ day: "Thu", start: "22:00", end: "02:00" }] } satisfies OfferSchedule;
  expect(matchesOfferSchedule(startsFriday, new Date("2026-01-02T06:00:00Z"))).toBe(false);
  const exceptions = {
    ...schedule,
    exceptions: { "2026-01-02": [], "2026-01-04": [{ start: "18:00", end: "20:00" }] },
  };
  expect(matchesOfferSchedule(exceptions, new Date("2026-01-03T06:00:00Z"))).toBe(false);
  expect(matchesOfferSchedule(exceptions, new Date("2026-01-04T23:00:00Z"))).toBe(true);
  expect(matchesOfferSchedule(exceptions, new Date("2026-01-05T01:00:00Z"))).toBe(false);
});

test("spring-forward skips missing minutes; fall-back repeats both matching instants", () => {
  const dst = {
    ...schedule, endsBefore: "2026-12-01",
    weekly: [{ day: "Sun", start: "01:30", end: "02:30" }],
  } satisfies OfferSchedule;
  expect(matchesOfferSchedule(dst, new Date("2026-03-08T06:59:00Z"))).toBe(true);
  expect(matchesOfferSchedule(dst, new Date("2026-03-08T07:00:00Z"))).toBe(false);
  expect(matchesOfferSchedule(dst, new Date("2026-11-01T05:45:00Z"))).toBe(true);
  expect(matchesOfferSchedule(dst, new Date("2026-11-01T06:15:00Z"))).toBe(false);
  expect(matchesOfferSchedule(dst, new Date("2026-11-01T06:45:00Z"))).toBe(true);
  expect(matchesOfferSchedule(dst, new Date(NaN))).toBe(false);
});

test("calendar match does not bypass draft, suspension, or pending or revoked approval", () => {
  const instant = new Date("2026-01-03T04:00:00Z");
  expect(matchesOfferSchedule(schedule, instant)).toBe(true);
  expect(isOfferScheduled({ ...offer, publication: "draft" }, instant)).toBe(false);
  expect(isOfferScheduled({ ...offer, publication: "suspended" }, instant)).toBe(false);
  expect(isOfferScheduled({ ...offer, approval: "pending" }, instant)).toBe(false);
  expect(isOfferScheduled({ ...offer, approval: "revoked" }, instant)).toBe(false);
});

test("validation rejects invalid data, duplicate IDs, and venue mismatches", () => {
  expect(validateOfferCatalog([offer], [venue], "public")).toEqual([]);
  expect(validateOfferCatalog([offer, offer], [venue])).toContain("synthetic-offer: invalid or duplicate offer ID");
  for (const invalid of [
    null, { ...offer, id: " " }, { ...offer, venueId: "missing" }, { ...offer, revision: 0 },
    { ...offer, terms: "" }, { ...offer, priceCents: 1.5 }, { ...offer, currency: "EUR" },
    { ...offer, schedule: { ...schedule, timeZone: "UTC" } },
    { ...offer, schedule: { ...schedule, startsOn: "2026-02-30" } },
    { ...offer, schedule: { ...schedule, endsBefore: schedule.startsOn } },
    { ...offer, schedule: { ...schedule, weekly: [{ day: "Fri", start: "24:00", end: "01:00" }] } },
    { ...offer, schedule: { ...schedule, exceptions: { "2026-02-01": [] } } },
    { ...offer, limits: { perCustomer: -1 } },
    { ...offer, inventory: {} },
    { ...offer, approval: "pending" },
    { ...offer, approvalEvidence: { source: "private" } },
  ]) expect(validateOfferCatalog([invalid], [venue], "public").length).toBeGreaterThan(0);
  expect(validateOfferCatalog([offer], [{ ...venue, status: "suspended" }], "public").length).toBeGreaterThan(0);
});

test("demo offers and venue references cannot enter the public candidate catalog", () => {
  const demo = {
    ...offer, id: "demo:test", isDemo: true, publication: "preview", approval: "not-applicable",
    venueId: venues[0].id,
  } satisfies Offer;
  expect(validateOfferCatalog([demo], venues)).toEqual([]);
  expect(validateOfferCatalog([demo], venues, "public").length).toBeGreaterThan(0);
  expect(validateOfferCatalog([{ ...offer, venueId: demo.venueId }], venues, "public").length).toBeGreaterThan(0);
  expect(validateOfferCatalog([{ ...offer, id: demo.id }], [venue], "public").length).toBeGreaterThan(0);
  expect(validateOfferCatalog(deals, venues, "public").length).toBeGreaterThan(0);
  expect(isOfferScheduled(demo, new Date("2026-01-03T04:00:00Z"))).toBe(false);
});
