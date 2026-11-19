import type { Deal } from "../data";
import type { DemoVenue } from "../domain/models";
import type { Offer, Weekday } from "../domain/offers";
import { marketForCity } from "../domain/markets";

const market = marketForCity("Las Vegas");
// Representative geographic points, never participating-business addresses.
// Geographic source references are recorded in docs/las-vegas-demo.md.
const fixtures = [
  {
    id: 7,
    name: "Cinder Circuit",
    category: "nightclub",
    neighborhood: "Fremont area",
    lat: 36.169221,
    lng: -115.140688,
    filter: "Late night",
    product: "house highball",
    description: "An imagined neon dance floor with a futuristic sound and warm amber lights."
  },
  {
    id: 8,
    name: "Saffron Static Lounge",
    category: "cocktail-bar",
    neighborhood: "Arts District",
    lat: 36.159596,
    lng: -115.15186,
    filter: "Cocktails",
    product: "citrus spritz",
    description: "A fictional cocktail lounge with desert colors and intimate conversation corners."
  },
  {
    id: 9,
    name: "Overtime Mirage",
    category: "sports-bar",
    neighborhood: "Arts District",
    lat: 36.160885,
    lng: -115.152168,
    filter: "Beer",
    product: "house draft",
    description: "An imagined sports bar with big screens, booth seating, and a relaxed game-night atmosphere."
  },
  {
    id: 10,
    name: "Copper Comet Rooftop",
    category: "rooftop-bar",
    neighborhood: "Downtown east",
    lat: 36.167059,
    lng: -115.135555,
    filter: "Cocktails",
    product: "sunset cooler",
    description: "A fictional rooftop concept with open-air seating and a desert-sky theme."
  },
  {
    id: 11,
    name: "Prism Tumble Club",
    category: "nightclub",
    neighborhood: "North Strip area",
    lat: 36.126114,
    lng: -115.168464,
    filter: "Late night",
    product: "house highball",
    description: "An imagined nightclub with prismatic lighting and a compact dance floor."
  },
  {
    id: 12,
    name: "Velour Voltage",
    category: "cocktail-bar",
    neighborhood: "Center Strip area",
    lat: 36.114658,
    lng: -115.172859,
    filter: "Cocktails",
    product: "botanical cooler",
    description: "A fictional lounge with velvet seating and a retro-futurist cocktail concept."
  },
  {
    id: 13,
    name: "Desert Signal Taproom",
    category: "beer-hall",
    neighborhood: "South Strip area",
    lat: 36.101526,
    lng: -115.173068,
    filter: "Beer",
    product: "house draft",
    description: "An imagined neighborhood taproom with communal tables and desert-inspired decor."
  }
] as const;

export const lasVegasVenues: readonly DemoVenue[] = fixtures.map((fixture) => ({
  id: `venue-lv-${fixture.id}`, name: fixture.name, category: fixture.category,
  city: market.city, timeZone: market.timeZone, neighborhood: fixture.neighborhood,
  isDemo: true, status: "preview",
  demoLocation: { lat: fixture.lat, lng: fixture.lng, kind: "demo" },
}));

export const lasVegasDeals: Deal[] = fixtures.map((fixture, index) => ({
  id: fixture.id, offerId: `demo:${fixture.id}`, isDemo: true,
  venue: lasVegasVenues[index], category: "$1 drinks", filterCategories: [fixture.filter],
  offer: `$1 ${fixture.product} preview`,
  description: `${fixture.description} Fictional demonstration listing and $1 offer. Cannot be redeemed. The pin represents an area only; no business at this location participates.`,
  time: "6 PM – 8 PM", image: "photo-1514933651103-005eec06c04b",
  tag: "FICTIONAL DEMO VENUE",
}));

const weekdays: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Sample calendar contracts only. These never grant availability or redemption. */
export const lasVegasOfferCatalog: Offer[] = fixtures.map((fixture) => ({
  id: `demo:${fixture.id}`, venueId: `venue-lv-${fixture.id}`, revision: 1,
  isDemo: true, publication: "preview", approval: "not-applicable",
  title: `$1 ${fixture.product} preview`, description: fixture.description,
  product: fixture.product,
  terms: "Fictional, non-redeemable demonstration for adults 21+. No purchase or claim available.",
  priceCents: 100, currency: "USD",
  schedule: {
    timeZone: market.timeZone, startsOn: "2026-01-01", endsBefore: "2029-01-01",
    weekly: weekdays.map((day) => ({ day, start: "18:00", end: "20:00" })),
  },
}));
