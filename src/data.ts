import { isVenueVisible, validateCatalog } from "./domain/catalog";
import type { City, DemoVenue, RealVenue, Venue } from "./domain/models";
export type { City } from "./domain/models";
export type Category =
  "All spots" | "$1 drinks" | "Cocktails" | "Beer" | "Late night";
export interface Deal {
  id: number;
  venue: DemoVenue;
  category: Category;
  offer: string;
  description: string;
  time: string;
  image: string;
  tag: string;
}
export type Listing = Deal | { id: string; venue: RealVenue };
export type SavedId = Listing["id"];

export const venues: readonly DemoVenue[] = [
  {
    id: "venue-1",
    isDemo: true,
    demoLocation: { lat: 39.3543, lng: -74.4335, kind: "demo" },
    name: "The Velvet Room",
    category: "bar",
    city: "Atlantic City",
    neighborhood: "The Boardwalk",
    timeZone: "America/New_York",
    status: "preview",
  },
  {
    id: "venue-2",
    isDemo: true,
    demoLocation: { lat: 39.36, lng: -74.4269, kind: "demo" },
    name: "Ember & Violet",
    category: "cocktail-bar",
    city: "Atlantic City",
    neighborhood: "Orange Loop",
    timeZone: "America/New_York",
    status: "preview",
  },
  {
    id: "venue-3",
    isDemo: true,
    demoLocation: { lat: 39.3784, lng: -74.427, kind: "demo" },
    name: "Low Tide Beer Hall",
    category: "beer-hall",
    city: "Atlantic City",
    neighborhood: "Marina District",
    timeZone: "America/New_York",
    status: "preview",
  },
  {
    id: "venue-4",
    isDemo: true,
    demoLocation: { lat: 39.3564, lng: -74.4431, kind: "demo" },
    name: "Midnight Standard",
    category: "nightclub",
    city: "Atlantic City",
    neighborhood: "Ducktown",
    timeZone: "America/New_York",
    status: "preview",
  },
  {
    id: "venue-5",
    isDemo: true,
    demoLocation: { lat: 40.7184, lng: -73.9875, kind: "demo" },
    name: "Juniper & Co.",
    category: "cocktail-bar",
    city: "New York City",
    neighborhood: "Lower East Side",
    timeZone: "America/New_York",
    status: "preview",
  },
  {
    id: "venue-6",
    isDemo: true,
    demoLocation: { lat: 40.7143, lng: -73.9614, kind: "demo" },
    name: "The Night Shift",
    category: "nightclub",
    city: "New York City",
    neighborhood: "Williamsburg",
    timeZone: "America/New_York",
    status: "preview",
  },
];

// Keep the preview UI and numeric saved-deal IDs stable.
const offers: (Omit<Deal, "venue"> & { venueId: string })[] = [
  {
    id: 1,
    venueId: "venue-1",
    category: "$1 drinks",
    offer: "$1 house drinks",
    description:
      "Low lights. Good company. Your new favorite start to the night.",
    time: "6 PM – 8 PM",
    image: "photo-1514933651103-005eec06c04b",
    tag: "THE EARLY-NIGHT FAVORITE",
  },
  {
    id: 2,
    venueId: "venue-2",
    category: "Cocktails",
    offer: "Cocktail hour, reimagined",
    description:
      "Fresh pours and a little golden-hour magic in the Orange Loop.",
    time: "5 PM – 7 PM",
    image: "photo-1470337458703-46ad1756a187",
    tag: "FOR THE COCKTAIL PEOPLE",
  },
  {
    id: 3,
    venueId: "venue-3",
    category: "Beer",
    offer: "Local drafts. Better nights.",
    description:
      "Find your next favorite local pour, a few steps off the beaten path.",
    time: "7 PM – 10 PM",
    image: "photo-1514933651103-005eec06c04b",
    tag: "KEEP IT LOCAL",
  },
  {
    id: 4,
    venueId: "venue-4",
    category: "Late night",
    offer: "Stay for one more song",
    description: "A late-night soundtrack and a cozy corner worth finding.",
    time: "10 PM – 12 AM",
    image: "photo-1514933651103-005eec06c04b",
    tag: "AFTER HOURS",
  },
  {
    id: 5,
    venueId: "venue-5",
    category: "Cocktails",
    offer: "A fresh take on happy hour",
    description:
      "Inventive cocktails and intimate conversations in downtown Manhattan.",
    time: "5 PM – 7 PM",
    image: "photo-1470337458703-46ad1756a187",
    tag: "DOWNTOWN ENERGY",
  },
  {
    id: 6,
    venueId: "venue-6",
    category: "Late night",
    offer: "Your after-hours hideaway",
    description: "Come for the music. Find a reason to stay.",
    time: "9 PM – 12 AM",
    image: "photo-1514933651103-005eec06c04b",
    tag: "THE NIGHT IS STILL YOUNG",
  },
];
const errors = validateCatalog(venues, offers);
if (errors.length) throw new Error(errors.join("\n"));

const venuesById = new Map(venues.map((venue) => [venue.id, venue]));
export const deals: Deal[] = offers.map(({ venueId, ...offer }) => {
  const venue = venuesById.get(venueId);
  if (!venue) throw new Error(`Unknown venue: ${venueId}`);
  return { ...offer, venue };
});

export function realVenueListings(catalog: readonly Venue[]): Listing[] {
  return catalog.flatMap((venue) =>
    !venue.isDemo && isVenueVisible(venue)
      ? [{ id: venue.id, venue }]
      : [],
  );
}

export function knownSavedIds(value: unknown, listings: readonly Listing[] = deals): SavedId[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(listings.map(({ id }) => id));
  return [...new Set(value.filter((id) => known.has(id)))];
}

export function filterDeals(
  city: City,
  category: Category,
  query: string,
  savedOnly: boolean,
  saved: SavedId[],
  catalog: readonly Listing[] = deals,
) {
  const search = query.trim().toLowerCase();
  return catalog.filter((listing) => {
    const { venue, id } = listing;
    const searchable = "offer" in listing ? listing.offer : venue.address;
    return isVenueVisible(venue) &&
      venue.city === city &&
      (category === "All spots" || ("offer" in listing && listing.category === category)) &&
      (!savedOnly || saved.includes(id)) &&
      `${venue.name} ${venue.neighborhood} ${searchable ?? ""}`.toLowerCase().includes(search);
  });
}
