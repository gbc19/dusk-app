/** Persistence-independent contracts; these types do not create accounts or services. */
export type City = 'Atlantic City' | 'New York City';
export type VenueId = string;
export type CustomerId = string;
export type StaffId = string;

export interface Venue {
  id: VenueId;
  name: string;
  city: City;
  neighborhood: string;
  /** IANA time zone, for future local event and reservation times. */
  timeZone: 'America/New_York';
  /** Preview is never evidence of approval for a live promotion. */
  status: 'preview' | 'active' | 'inactive';
}

/** Private profile. Not used by anonymous MVP browsing or local saved spots. */
export interface Customer {
  id: CustomerId;
  displayName: string;
  status: 'active' | 'inactive';
}

/** Private staff identity; permissions belong to individual venue assignments. */
export interface Staff {
  id: StaffId;
  displayName: string;
  status: 'active' | 'inactive';
}

/** One assignment per (venueId, staffId), allowing work at multiple venues. */
export interface VenueStaffAssignment {
  venueId: VenueId;
  staffId: StaffId;
  role: 'manager' | 'staff';
  status: 'active' | 'inactive';
}
