/** Persistence-independent contracts; these types do not create accounts or services. */
import type { City } from "./markets";
export type { City } from "./markets";
export type VenueId = string;
export type CustomerId = string;
export type StaffId = string;

export const venueCategories = ["bar", "cocktail-bar", "beer-hall", "nightclub", "sports-bar", "rooftop-bar"] as const;
export type Coordinates = { lat: number; lng: number };

interface VenueIdentity {
  id: VenueId;
  name: string;
  city: City;
  neighborhood: string;
  timeZone: string;
  category: (typeof venueCategories)[number];
}

export interface DemoVenue extends VenueIdentity {
  isDemo: true;
  status: "preview";
  demoLocation: Coordinates & { kind: "demo" };
  address?: never;
  verifiedLocation?: never;
}

export interface RealVenue extends VenueIdentity {
  isDemo: false;
  status: "draft" | "verified" | "published" | "suspended";
  address?: string;
  verifiedLocation?: Coordinates & { verified: true };
  demoLocation?: never;
}

export type Venue = DemoVenue | RealVenue;

/** Private input for catalog review, never part of a public venue record. */
export interface VenueVerification {
  venueId: VenueId;
  reviewedBy: string;
  reviewedAt: string;
  source: string;
  coordinateSource?: string;
}

/** Private profile. Not used by anonymous MVP browsing or local saved spots. */
export interface Customer {
  id: CustomerId;
  displayName: string;
  status: "active" | "inactive";
}

/** Private staff identity; permissions belong to individual venue assignments. */
export interface Staff {
  id: StaffId;
  displayName: string;
  status: "active" | "inactive";
}

/** One assignment per (venueId, staffId), allowing work at multiple venues. */
export interface VenueStaffAssignment {
  venueId: VenueId;
  staffId: StaffId;
  role: "manager" | "staff";
  status: "active" | "inactive";
}
