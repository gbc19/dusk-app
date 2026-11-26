import type { Json } from './json';
export type PublicVenueRow = { id: string; market_id: string; city: string; time_zone: string; name: string; neighborhood: string; category: string; address: string; lat: number | null; lng: number | null };
export type PublicOfferRow = { id: string; venue_id: string; revision_no: number; title: string; description: string; product: string; terms: string; price_cents: number; currency: string; schedule: Json; per_customer_limit: number | null; per_occurrence_limit: number | null; inventory_units: number | null };
type View<Row> = { Row: Row; Relationships: [] };
/** Hand-maintained allowlist of the exposed customer API, never private database tables. */
export type Database = { api: {
  Tables: Record<never, never>;
  Views: {
    public_venues: View<PublicVenueRow>;
    public_offers: View<PublicOfferRow>;
    my_account: View<{ id: string; display_name: string | null; status: string }>;
    markets: View<{ id: string; display_name: string; state_code: string; time_zone: string; center_lat: number; center_lng: number }>;
  };
  Functions: { ensure_account: { Args: { display_name?: string }; Returns: string } };
  Enums: Record<never, never>;
  CompositeTypes: Record<never, never>;
} };
