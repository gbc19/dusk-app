import type { Venue } from "./models";
import { venueMapPosition } from "./catalog";

/** Fail closed: demo pins and ordinary coordinates never establish verification. */
export function venueDirectionsUrl(venue: Venue | undefined): string | null {
  if (venue?.isDemo !== false) return null;
  const position = venueMapPosition(venue);
  if (!position) return null;
  const { lat, lng } = position;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
