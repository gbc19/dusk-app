import { expect, test } from "vitest";
import { venues, deals, directionsUrl } from "../data";
import { venueDirectionsUrl } from "./directions";
const verified = { lat: 40.7, lng: -74, verified: true as const };
test("every fictional venue blocks directions, including mistakenly attached verification", () => {
  for (const venue of venues) {
    expect(venue.isDemo).toBe(true);
    expect(venueDirectionsUrl(venue)).toBeNull();
    expect(
      venueDirectionsUrl({ ...venue, verifiedLocation: verified }),
    ).toBeNull();
  }
  for (const deal of deals) expect(directionsUrl(deal)).toBeNull();
});
test("coordinates and active status alone do not enable real-venue directions", () => {
  expect(
    venueDirectionsUrl({ ...venues[0], isDemo: false, status: "active" }),
  ).toBeNull();
  expect(venueDirectionsUrl(undefined)).toBeNull();
});
test("only explicitly real venues with verified valid coordinates are eligible", () => {
  expect(
    venueDirectionsUrl({
      ...venues[0],
      isDemo: false,
      verifiedLocation: verified,
    }),
  ).toBe("https://www.google.com/maps/dir/?api=1&destination=40.7,-74");
  for (const location of [
    { ...verified, lat: NaN },
    { ...verified, lng: Infinity },
    { ...verified, lat: 91 },
    { ...verified, lng: -181 },
  ])
    expect(
      venueDirectionsUrl({
        ...venues[0],
        isDemo: false,
        verifiedLocation: location,
      }),
    ).toBeNull();
});
