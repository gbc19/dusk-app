import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database';
import type { BackendConfig } from './config';

export const sessionKey = 'dusk-local-auth-v1';
let cached: { identity: string; client: ReturnType<typeof makeBackend> } | undefined;
/** Native tokens are memory-only. Web persistence is tab-scoped and remains vulnerable to XSS. */
export function authStorage(native: boolean): SupportedStorage {
  const memory = new Map<string, string>();
  let memoryOnly = native;
  return {
    getItem(key) { try { return memoryOnly ? memory.get(key) ?? null : sessionStorage.getItem(key); } catch { memoryOnly = true; return memory.get(key) ?? null; } },
    setItem(key, value) { memory.set(key, value); if (!memoryOnly) { try { sessionStorage.setItem(key, value); } catch { memoryOnly = true; } } },
    removeItem(key) { memory.delete(key); if (!native) { try { sessionStorage.removeItem(key); } catch { /* Storage denied. */ } } },
  };
}
export function createBackend(config: Extract<BackendConfig, { mode: 'backend' }>, native: boolean) {
  const identity = `${native}:${config.url}:${config.publicKey}`;
  if (cached?.identity === identity) return cached.client;
  const client = makeBackend(config, native);
  cached = { identity, client };
  return client;
}
function makeBackend(config: Extract<BackendConfig, { mode: 'backend' }>, native: boolean) {
  return createClient<Database, 'api'>(config.url, config.publicKey, {
    db: { schema: 'api', retry: false },
    auth: { storage: authStorage(native), storageKey: sessionKey, persistSession: true,
      autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }) },
  });
}
export type BackendClient = ReturnType<typeof createBackend>;
