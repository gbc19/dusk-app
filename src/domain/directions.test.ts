import { expect, test } from "vitest";
import { venues } from "../data";
import { venueDirectionsUrl } from "./directions";
import type { RealVenue, Venue } from "./models";

const verifiedLocation = { lat: 40.7, lng: -74, verified: true } as const;
const real: RealVenue = {
  id: "real-test",
  name: "Sample real venue",
  city: "New York City",
  neighborhood: "Sample neighborhood",
  timeZone: "America/New_York",
  category: "bar",
  isDemo: false,
  status: "published",
  address: "Test address",
  verifiedLocation,
};

test("fictional venues block directions even with mistakenly attached verification", () => {
  for (const venue of venues) {
    const malformed = { ...venue, verifiedLocation } as unknown as Venue;
    expect(venueDirectionsUrl(venue)).toBeNull();
    expect(venueDirectionsUrl(malformed)).toBeNull();
  }
});

test("only published real venues with verified valid coordinates enable directions", () => {
  expect(venueDirectionsUrl(real)).toBe("https://www.google.com/maps/dir/?api=1&destination=40.7,-74");
  expect(venueDirectionsUrl(undefined)).toBeNull();
  expect(venueDirectionsUrl({ ...real, address: undefined })).toBeNull();
  expect(venueDirectionsUrl({ ...real, verifiedLocation: undefined })).toBeNull();
  for (const status of ["draft", "verified", "suspended"] as const) {
    expect(venueDirectionsUrl({ ...real, status })).toBeNull();
  }
  for (const location of [
    { ...verifiedLocation, lat: NaN },
    { ...verifiedLocation, lng: Infinity },
    { ...verifiedLocation, lat: 91 },
    { ...verifiedLocation, lng: -181 },
  ]) {
    expect(venueDirectionsUrl({ ...real, verifiedLocation: location })).toBeNull();
  }
});
