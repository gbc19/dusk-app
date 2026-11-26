import { describe, it, expect, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readBackendConfig } from './config';
import { authStorage, sessionKey } from './client';
import { publicCatalog } from './catalog';
const publicKey = 'sb_publishable_synthetic';
describe('local configuration boundaries', () => {
  it('defaults to demo with no backend credentials', () => expect(readBackendConfig({})).toEqual({ mode: 'demo' }));
  it('accepts an explicit loopback public client', () => expect(readBackendConfig({ VITE_DATA_MODE: 'backend', VITE_SUPABASE_URL: 'http://127.0.0.1:55321', VITE_SUPABASE_PUBLISHABLE_KEY: publicKey }).mode).toBe('backend'));
  it.each(['sb_secret_private', 'invalid', `e30.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`])('rejects nonpublic keys without echoing them', key => {
    expect(() => readBackendConfig({ VITE_DATA_MODE: 'backend', VITE_SUPABASE_URL: 'http://127.0.0.1:55321', VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrow('public Supabase');
  });
  it('rejects hosted endpoints and unknown modes', () => {
    expect(() => readBackendConfig({ VITE_DATA_MODE: 'backend', VITE_SUPABASE_URL: 'https://example.com', VITE_SUPABASE_PUBLISHABLE_KEY: publicKey })).toThrow();
    expect(() => readBackendConfig({ VITE_DATA_MODE: 'typo' })).toThrow();
  });
  it('refuses native backend configuration outside the explicit debug build', () => {
    const env = { DUSK_NATIVE_PUBLIC_DATA_MODE: 'backend', DUSK_NATIVE_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321', DUSK_NATIVE_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey };
    expect(() => readBackendConfig(env, true)).toThrow();
    expect(readBackendConfig(env, true, true).mode).toBe('backend');
  });
});
describe('session storage', () => {
  it('restores web sessions only within the current tab and clears logout data', async () => {
    const storage = authStorage(false); await storage.setItem(sessionKey, 'synthetic');
    expect(await authStorage(false).getItem(sessionKey)).toBe('synthetic');
    await storage.removeItem(sessionKey); expect(await storage.getItem(sessionKey)).toBeNull();
  });
  it('never persists native tokens to web storage or another client instance', async () => {
    const storage = authStorage(true); await storage.setItem(sessionKey, 'synthetic');
    expect(await storage.getItem(sessionKey)).toBe('synthetic');
    expect(await authStorage(true).getItem(sessionKey)).toBeNull();
    expect(localStorage.getItem(sessionKey)).toBeNull(); expect(sessionStorage.getItem(sessionKey)).toBeNull();
    await storage.removeItem(sessionKey); expect(await storage.getItem(sessionKey)).toBeNull();
  });
  it('removes an expired restored session when refresh is rejected', async () => {
    const storage = authStorage(true);
    const key = 'synthetic-expired-session';
    await storage.setItem(key, JSON.stringify({ access_token: 'synthetic-expired', refresh_token: 'synthetic-revoked', expires_at: 1, expires_in: 1, token_type: 'bearer', user: { id: 'synthetic' } }));
    const request = vi.fn(async () => new Response(JSON.stringify({ error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    const client = createClient('http://127.0.0.1:55321', 'sb_publishable_synthetic', { auth: { storage, storageKey: key, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: request } });
    const result = await client.auth.getSession();
    expect(result.data.session).toBeNull(); expect(await storage.getItem(key)).toBeNull(); expect(request).toHaveBeenCalled();
  });
});
describe('public data adapter', () => {
  it('keeps empty public feeds empty', () => expect(publicCatalog([], [])).toEqual({ venues: [], offers: [] }));
  const venue = { id: 'synthetic', market_id: 'las-vegas', city: 'Las Vegas', time_zone: 'America/Los_Angeles', name: 'Synthetic public test', neighborhood: 'Synthetic', category: 'bar', address: 'Synthetic address', lat: null, lng: null };
  it('reuses stable market and venue identities without inventing coordinates', () => {
    const result = publicCatalog([venue], []); expect(result.venues[0].id).toBe('synthetic'); expect(result.venues[0].verifiedLocation).toBeUndefined();
  });
  it.each([{ ...venue, address: '' }, { ...venue, time_zone: 'America/New_York' }, { ...venue, lat: 36 }, { ...venue, category: 'unknown' }])('fails closed for malformed public rows', row => expect(() => publicCatalog([row], [])).toThrow());
});
