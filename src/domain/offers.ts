import { isTimeZone, isVenueVisible } from "./catalog";
import type { Venue, VenueId } from "./models";

export type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type OfferHours = { start: string; end: string };

export interface OfferSchedule {
  timeZone: string;
  startsOn: string;
  endsBefore: string;
  weekly: readonly (OfferHours & { day: Weekday })[];
  /** Replaces the windows starting on that service date. An empty array closes it. */
  exceptions?: Readonly<Record<string, readonly OfferHours[]>>;
}

interface OfferDetails {
  id: string;
  venueId: VenueId;
  revision: number;
  title: string;
  description: string;
  product: string;
  terms: string;
  priceCents: number;
  currency: "USD";
  schedule: OfferSchedule;
  limits?: { perCustomer?: number; perOccurrence?: number };
  inventory?: { unitsPerOccurrence: number };
}

export type Offer = OfferDetails & (
  | { isDemo: true; publication: "preview"; approval: "not-applicable" }
  | {
      isDemo: false;
      publication: "draft" | "published" | "suspended";
      approval: "pending" | "approved" | "revoked";
    }
);

/** Future private record, kept outside public offers and tied to the exact revision. */
export interface OfferApprovalEvidence {
  offerId: string;
  revision: number;
  reviewedBy: string;
  reviewedAt: string;
  source: string;
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnly(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(value).every((key) => fields.includes(key));
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isId(value: unknown): value is string {
  return hasText(value) && value.trim() === value;
}

function positiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isHours(value: unknown, weekly: boolean): boolean {
  if (!record(value) || !hasOnly(value, weekly ? ["day", "start", "end"] : ["start", "end"])) return false;
  return isTime(value.start) && isTime(value.end) && value.start !== value.end &&
    (!weekly || weekdays.some((day) => day === value.day));
}

function validSchedule(value: unknown): value is OfferSchedule {
  if (!record(value) || !hasOnly(value, ["timeZone", "startsOn", "endsBefore", "weekly", "exceptions"]) ||
      !isTimeZone(value.timeZone) || !isDate(value.startsOn) || !isDate(value.endsBefore) ||
      value.startsOn >= value.endsBefore || !Array.isArray(value.weekly) ||
      !value.weekly.every((window) => isHours(window, true))) return false;
  const { exceptions, startsOn, endsBefore } = value;
  return exceptions === undefined || (record(exceptions) &&
    Object.entries(exceptions).every(([date, windows]) =>
      isDate(date) && date >= startsOn && date < endsBefore &&
      Array.isArray(windows) && windows.every((window) => isHours(window, false)),
    ));
}

/** Validates one current revision per offer ID. Public mode is a future data-shape check only. */
export function validateOfferCatalog(
  input: unknown,
  venues: readonly Venue[],
  mode: "internal" | "public" = "internal",
): string[] {
  if (!Array.isArray(input)) return ["Expected an offer array"];
  const byVenue = new Map(venues.map((venue) => [venue.id, venue]));
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const offer of input) {
    if (!record(offer)) {
      errors.push("Expected an offer record");
      continue;
    }
    const label = isId(offer.id) ? offer.id : "(missing ID)";
    if (!isId(offer.id) || ids.has(offer.id)) errors.push(`${label}: invalid or duplicate offer ID`);
    else ids.add(offer.id);
    if (!hasOnly(offer, [
      "id", "venueId", "revision", "title", "description", "product", "terms",
      "priceCents", "currency", "schedule", "limits", "inventory", "isDemo", "publication", "approval",
    ])) errors.push(`${label}: unexpected offer fields`);
    if (!positiveInteger(offer.revision) ||
        ![offer.title, offer.description, offer.product, offer.terms].every(hasText)) {
      errors.push(`${label}: invalid revision or missing offer details`);
    }
    if (!positiveInteger(offer.priceCents) || offer.currency !== "USD") {
      errors.push(`${label}: expected a positive integer price in USD cents`);
    }
    const venue = isId(offer.venueId) ? byVenue.get(offer.venueId) : undefined;
    if (!venue || venue.isDemo !== offer.isDemo) errors.push(`${label}: invalid venue reference or demo mismatch`);
    if (!validSchedule(offer.schedule) || (venue && offer.schedule.timeZone !== venue.timeZone)) {
      errors.push(`${label}: invalid schedule or venue time zone mismatch`);
    }
    const { limits, inventory } = offer;
    if (limits !== undefined && (!record(limits) || !hasOnly(limits, ["perCustomer", "perOccurrence"]) ||
        !Object.values(limits).every(positiveInteger))) errors.push(`${label}: invalid limits`);
    if (inventory !== undefined && (!record(inventory) ||
        !hasOnly(inventory, ["unitsPerOccurrence"]) || !positiveInteger(inventory.unitsPerOccurrence))) {
      errors.push(`${label}: invalid inventory`);
    }
    const { isDemo, publication, approval } = offer;
    if (isId(offer.id) && offer.id.startsWith("demo:") !== (isDemo === true)) {
      errors.push(`${label}: offer ID does not match demo identity`);
    }
    const coherentStatus = isDemo === true
      ? publication === "preview" && approval === "not-applicable"
      : isDemo === false &&
        (publication === "draft" || publication === "suspended" || publication === "published") &&
        (approval === "pending" || approval === "approved" || approval === "revoked") &&
        (publication !== "published" || approval === "approved");
    if (!coherentStatus) errors.push(`${label}: inconsistent publication or approval state`);
    if (mode === "public" && (isDemo !== false || publication !== "published" ||
        approval !== "approved" || !venue || !isVenueVisible(venue))) {
      errors.push(`${label}: not eligible for a public offer catalog`);
    }
  }
  return errors;
}

function windowsFor(schedule: OfferSchedule, serviceDate: string): readonly OfferHours[] {
  const exception = schedule.exceptions?.[serviceDate];
  if (exception !== undefined) return exception;
  const day = weekdays[new Date(`${serviceDate}T00:00:00Z`).getUTCDay()];
  return schedule.weekly.filter((window) => window.day === day);
}

/** Calendar calculation only, based on wall-clock time in the venue's zone. */
export function matchesOfferSchedule(schedule: OfferSchedule, at: Date): boolean {
  if (!Number.isFinite(at.valueOf()) || !validSchedule(schedule)) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  const date = `${part("year")?.padStart(4, "0")}-${part("month")}-${part("day")}`;
  const time = `${part("hour")}:${part("minute")}`;
  if (date < schedule.startsOn || date >= schedule.endsBefore) return false;

  if (windowsFor(schedule, date).some(({ start, end }) =>
    time >= start && (end < start || time < end),
  )) return true;

  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const previousDate = previous.toISOString().slice(0, 10);
  return previousDate >= schedule.startsOn &&
    windowsFor(schedule, previousDate).some(({ start, end }) => end < start && time < end);
}

/** A published, approved offer in its window. This grants no promotion or redemption authority. */
export function isOfferScheduled(offer: Offer, at: Date): boolean {
  return offer.isDemo === false && offer.publication === "published" &&
    offer.approval === "approved" && matchesOfferSchedule(offer.schedule, at);
}
