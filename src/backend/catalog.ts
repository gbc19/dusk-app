import type { BackendClient } from './client';
import type { PublicVenueRow, PublicOfferRow } from './database';
import { markets } from '../domain/markets';
import { validateCatalog } from '../domain/catalog';
import { validateOfferCatalog, type Offer } from '../domain/offers';
import type { RealVenue } from '../domain/models';

export function publicCatalog(rows: PublicVenueRow[], offers: PublicOfferRow[]): { venues: RealVenue[]; offers: Offer[] } {
  const venues = rows.map((row): RealVenue => {
    const market = markets.find(({ id }) => id === row.market_id);
    if (!market || market.city !== row.city || market.timeZone !== row.time_zone || (row.lat === null) !== (row.lng === null)) throw new Error('Invalid public catalog.');
    return { id: row.id, name: row.name, city: market.city, neighborhood: row.neighborhood,
      category: row.category as RealVenue['category'], timeZone: row.time_zone, address: row.address,
      isDemo: false, status: 'published', ...(row.lat !== null && row.lng !== null ? { verifiedLocation: { lat: row.lat, lng: row.lng, verified: true } } : {}) };
  });
  const mapped = offers.map((row): Offer => ({ id: row.id, venueId: row.venue_id, revision: row.revision_no,
    title: row.title, description: row.description, product: row.product, terms: row.terms, priceCents: row.price_cents,
    currency: row.currency as 'USD', schedule: row.schedule as unknown as Offer['schedule'],
    isDemo: false, publication: 'published', approval: 'approved',
    ...(row.per_customer_limit !== null || row.per_occurrence_limit !== null ? { limits: {
      ...(row.per_customer_limit !== null ? { perCustomer: row.per_customer_limit } : {}),
      ...(row.per_occurrence_limit !== null ? { perOccurrence: row.per_occurrence_limit } : {}),
    } } : {}), ...(row.inventory_units !== null ? { inventory: { unitsPerOccurrence: row.inventory_units } } : {}) }));
  if (validateCatalog(venues, [], 'public').length || validateOfferCatalog(mapped, venues, 'public').length) throw new Error('Invalid public catalog.');
  return { venues, offers: mapped };
}
/** Public-only feeds. Staff views are never a fallback. More than one page fails closed for this pilot. */
export async function loadPublicCatalog(client: BackendClient) {
  const [venues, offers] = await Promise.all([
    client.from('public_venues').select('*').limit(200), client.from('public_offers').select('*').limit(200),
  ]);
  if (venues.error || offers.error || !venues.data || !offers.data || venues.data.length >= 200 || offers.data.length >= 200) throw new Error('Backend discovery is unavailable.');
  return publicCatalog(venues.data, offers.data);
}
