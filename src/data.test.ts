import { expect, test } from 'vitest';
import { deals, venues } from './data';

test('demo offers reference unique preview venue records without changing saved IDs', () => {
  expect(new Set(venues.map(venue => venue.id)).size).toBe(venues.length);
  expect(new Set(deals.map(deal => deal.id)).size).toBe(deals.length);
  expect(deals.map(deal => deal.id)).toEqual([1, 2, 3, 4, 5, 6]);
  for (const deal of deals) {
    const venue = venues.find(item => item.id === deal.venueId);
    expect(venue).toBeDefined();
    expect(venue?.status).toBe('preview');
    expect(deal.name).toBe(venue?.name);
    expect(deal.city).toBe(venue?.city);
  }
});
