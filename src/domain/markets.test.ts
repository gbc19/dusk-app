import { expect, test } from "vitest";
import { markets, marketForCity, preferredMarket } from "./markets";
import { deals, filterDeals, venues } from "../data";
import { lasVegasDeals, lasVegasOfferCatalog, lasVegasVenues } from "../data/las-vegas";
import { validateCatalog, venueMapPosition } from "./catalog";
import { isOfferScheduled, matchesOfferSchedule, validateOfferCatalog } from "./offers";
import { venueDirectionsUrl } from "./directions";

test("market IDs are unique and preference handling preserves known markets", () => {
  expect(new Set(markets.map((market) => market.id)).size).toBe(3);
  expect(preferredMarket(null).id).toBe("las-vegas");
  expect(preferredMarket("invalid").id).toBe("las-vegas");
  for (const market of markets) {
    expect(preferredMarket(market.id)).toBe(market);
    expect(preferredMarket(market.city)).toBe(market);
    expect(marketForCity(market.city)).toBe(market);
    expect(Number.isFinite(market.center.lat)).toBe(true);
    expect(Number.isFinite(market.center.lng)).toBe(true);
    expect(() => new Intl.DateTimeFormat("en", { timeZone: market.timeZone })).not.toThrow();
  }
  expect(marketForCity("Las Vegas").timeZone).toBe("America/Los_Angeles");
});

test("all seven Las Vegas demo venues and $1 contracts validate and remain non-redeemable", () => {
  expect(lasVegasVenues).toHaveLength(7);
  expect(new Set(venues.map((venue) => venue.id)).size).toBe(13);
  expect(new Set(deals.map((deal) => deal.id)).size).toBe(13);
  expect(validateCatalog(venues, deals.map((deal) => ({ venueId: deal.venue.id })))).toEqual([]);
  expect(validateOfferCatalog(lasVegasOfferCatalog, venues)).toEqual([]);
  expect(validateCatalog([{ ...lasVegasVenues[0], timeZone: "America/New_York" }])).not.toEqual([]);
  expect(validateOfferCatalog(lasVegasOfferCatalog, venues, "public")).not.toEqual([]);
  for (const venue of lasVegasVenues) {
    expect(venue.timeZone).toBe("America/Los_Angeles");
    expect(venue.demoLocation.lat).toBeGreaterThan(36.09);
    expect(venue.demoLocation.lat).toBeLessThan(36.18);
    expect(venue.demoLocation.lng).toBeGreaterThan(-115.18);
    expect(venue.demoLocation.lng).toBeLessThan(-115.13);
    expect(venueMapPosition(venue)).toBe(venue.demoLocation);
    expect(venueDirectionsUrl(venue)).toBeNull();
    expect(venue.address).toBeUndefined();
    expect(venue.verifiedLocation).toBeUndefined();
  }
  for (const offer of lasVegasOfferCatalog) {
    expect(offer.priceCents).toBe(100);
    expect(offer.terms).toContain("non-redeemable");
    expect(matchesOfferSchedule(offer.schedule, new Date("2026-11-19T02:00:00Z"))).toBe(true);
    expect(matchesOfferSchedule(offer.schedule, new Date("2026-11-19T04:00:00Z"))).toBe(false);
    expect(isOfferScheduled(offer, new Date("2026-11-19T02:00:00Z"))).toBe(false);
  }
  for (const deal of lasVegasDeals) {
    expect(deal.offer).toContain("$1");
    expect(deal.tag).toBe("FICTIONAL DEMO VENUE");
    expect(deal.description).toContain("Cannot be redeemed");
    expect(lasVegasOfferCatalog.find((offer) => offer.id === deal.offerId)?.venueId).toBe(deal.venue.id);
  }
});

test("three markets retain their own results and Vegas supports all existing filters", () => {
  expect(filterDeals("Atlantic City", "All spots", "", false, []).map((deal) => deal.id)).toEqual([1, 2, 3, 4]);
  expect(filterDeals("New York City", "All spots", "", false, []).map((deal) => deal.id)).toEqual([5, 6]);
  expect(filterDeals("Las Vegas", "$1 drinks", "", false, [])).toHaveLength(7);
  expect(filterDeals("Las Vegas", "Cocktails", "", false, [])).toHaveLength(3);
  expect(filterDeals("Las Vegas", "Beer", "", false, [])).toHaveLength(2);
  expect(filterDeals("Las Vegas", "Late night", "", false, [])).toHaveLength(2);
  expect(filterDeals("Las Vegas", "Beer", "overtime", true, [9]).map((deal) => deal.id)).toEqual([9]);
  expect(filterDeals("Las Vegas", "All spots", "Juniper", false, [])).toEqual([]);
});
