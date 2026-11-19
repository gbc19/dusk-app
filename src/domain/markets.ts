/** Consumer markets. Licensing jurisdiction must be verified separately for each real venue. */
export const markets = [
  {
    id: "las-vegas",
    city: "Las Vegas",
    displayName: "Las Vegas",
    state: "NV",
    center: {
      lat: 36.145,
      lng: -115.156
    },
    timeZone: "America/Los_Angeles"
  },
  {
    id: "atlantic-city",
    city: "Atlantic City",
    displayName: "Atlantic City",
    state: "NJ",
    center: {
      lat: 39.3643,
      lng: -74.4229
    },
    timeZone: "America/New_York"
  },
  {
    id: "new-york-city",
    city: "New York City",
    displayName: "New York City",
    state: "NY",
    center: {
      lat: 40.725,
      lng: -73.975
    },
    timeZone: "America/New_York"
  }
] as const;
export type Market = (typeof markets)[number];
export type MarketId = Market["id"];
export type City = Market["city"];
export const defaultMarket = markets[0];

export function marketForCity(city: City): Market {
  return markets.find((market) => market.city === city)!;
}

/** Accept stable IDs and display-name preferences. Saved spots never imply a market preference. */
export function preferredMarket(value: unknown): Market {
  return markets.find((market) => market.id === value || market.city === value) ?? defaultMarket;
}
