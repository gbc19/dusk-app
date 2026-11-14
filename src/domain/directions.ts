import type { Venue } from "./models";

/** Fail closed: demo pins and ordinary coordinates never establish verification. */
export function venueDirectionsUrl(venue: Venue | undefined): string | null {
  const location = venue?.verifiedLocation;
  if (venue?.isDemo !== false || location?.verified !== true) return null;
  const { lat, lng } = location;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
