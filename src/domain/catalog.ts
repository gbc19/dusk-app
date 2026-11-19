import {
  venueCategories,
  type Coordinates,
  type RealVenue,
  type Venue,
  type VenueVerification,
} from "./models";

import { markets } from "./markets";

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validCoordinates(location: Coordinates | undefined): location is Coordinates {
  return !!location &&
    Number.isFinite(location.lat) && Math.abs(location.lat) <= 90 &&
    Number.isFinite(location.lng) && Math.abs(location.lng) <= 180;
}

export function isVenueVisible(venue: Venue): boolean {
  return venue.isDemo === true
    ? venue.status === "preview"
    : venue.isDemo === false && venue.status === "published" && hasText(venue.address);
}

export function venueMapPosition(venue: Venue): Coordinates | null {
  if (!isVenueVisible(venue)) return null;
  if (venue.isDemo) {
    return venue.demoLocation?.kind === "demo" && validCoordinates(venue.demoLocation)
      ? venue.demoLocation : null;
  }
  return venue.verifiedLocation?.verified === true && validCoordinates(venue.verifiedLocation)
    ? venue.verifiedLocation : null;
}

export function isTimeZone(value: unknown): value is string {
  if (!hasText(value) || !/^(?:UTC$|[A-Za-z_]+\/)/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateCatalog(
  venues: readonly Venue[],
  previewOffers: readonly { venueId: string }[] = [],
  mode: "catalog" | "public" = "catalog",
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const demoIds = new Set<string>();
  for (const venue of venues) {
    const label = hasText(venue.id) ? venue.id : "(missing ID)";
    if (!hasText(venue.id) || venue.id.trim() !== venue.id) {
      errors.push(`${label}: missing or malformed venue ID`);
    } else if (ids.has(venue.id)) {
      errors.push(`${label}: duplicate venue ID`);
    } else {
      ids.add(venue.id);
    }
    if (!hasText(venue.name) || !hasText(venue.neighborhood) ||
        !markets.some((market) => market.city === venue.city && market.timeZone === venue.timeZone) ||
        !venueCategories.includes(venue.category) || !isTimeZone(venue.timeZone)) {
      errors.push(`${label}: missing or invalid venue fields`);
    }
    if (venue.isDemo === true) {
      demoIds.add(venue.id);
      if (mode === "public") errors.push(`${label}: demo venue in public catalog`);
      if (venue.status !== "preview" || venue.verifiedLocation !== undefined || venue.address !== undefined) {
        errors.push(`${label}: inconsistent demo status or verification`);
      }
      if (venue.demoLocation?.kind !== "demo" || !validCoordinates(venue.demoLocation)) {
        errors.push(`${label}: invalid demo coordinates`);
      }
    } else if (venue.isDemo === false) {
      if (!["draft", "verified", "published", "suspended"].includes(venue.status) ||
          venue.demoLocation !== undefined ||
          (venue.status === "draft" && venue.verifiedLocation !== undefined)) {
        errors.push(`${label}: inconsistent real status or verification`);
      }
      if ((venue.status === "verified" || venue.status === "published") && !hasText(venue.address)) {
        errors.push(`${label}: missing verified address`);
      }
      if (venue.verifiedLocation !== undefined &&
          (venue.verifiedLocation?.verified !== true || !validCoordinates(venue.verifiedLocation))) {
        errors.push(`${label}: invalid verified coordinates`);
      }
      if (mode === "public" && venue.status !== "published") {
        errors.push(`${label}: unpublished venue in public catalog`);
      }
    } else {
      errors.push(`${label}: missing explicit venue identity`);
    }
  }
  for (const { venueId } of previewOffers) {
    if (!ids.has(venueId)) errors.push(`Unknown venue reference: ${venueId}`);
    else if (!demoIds.has(venueId)) errors.push(`Preview offer references real venue: ${venueId}`);
  }
  return errors;
}

function publicVenue({ id, name, city, neighborhood, timeZone, category, address, verifiedLocation }: Venue): RealVenue {
  return {
    id, name, city, neighborhood, timeZone, category, address,
    isDemo: false, status: "published",
    ...(verifiedLocation && {
      verifiedLocation: { lat: verifiedLocation.lat, lng: verifiedLocation.lng, verified: true },
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype;
}

/** Accept only a complete, valid public export. A bad row invalidates the import. */
export function importPublicCatalog(input: unknown): RealVenue[] {
  if (!Array.isArray(input)) return [];
  const venues: Venue[] = [];
  for (const row of input) {
    if (!isRecord(row)) return [];
    const location = row.verifiedLocation;
    if (location !== undefined && !isRecord(location)) return [];
    if (row.isDemo !== false || row.status !== "published") return [];
    // Check public keys against the same projection used by the private exporter.
    const venue = row as unknown as RealVenue;
    const allowed = publicVenue(venue);
    if (Object.keys(row).some(
          (key) => key !== "verifiedLocation" && !Object.hasOwn(allowed, key),
        ) ||
        (isRecord(location) && Object.keys(location).some(
          (key) => !Object.hasOwn(allowed.verifiedLocation!, key),
        ))) return [];
    venues.push(venue);
  }
  return validateCatalog(venues, [], "public").length ? [] : venues.map(publicVenue);
}

/** Call at the private publication boundary. Only allowlisted fields leave it. */
export function exportPublicCatalog(
  venues: readonly Venue[],
  verification: readonly VenueVerification[],
): RealVenue[] {
  const errors = validateCatalog(venues, [], "public");
  for (const venue of venues) {
    const records = verification.filter((record) => record.venueId === venue.id);
    const record = records[0];
    if (records.length !== 1 || !hasText(record?.reviewedBy) ||
        !hasText(record?.source) || !Number.isFinite(Date.parse(record?.reviewedAt))) {
      errors.push(`${venue.id}: expected one complete private verification record`);
    }
    if (venue.verifiedLocation && !hasText(record?.coordinateSource)) {
      errors.push(`${venue.id}: missing private coordinate verification source`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return venues.map(publicVenue);
}
