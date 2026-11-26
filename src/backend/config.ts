export type BackendConfig = { mode: 'demo' } | { mode: 'backend'; url: string; publicKey: string };

/** This milestone deliberately permits only the isolated local backend. Never log input. */
export function readBackendConfig(env: Record<string, unknown>, native = false, localNative = false): BackendConfig {
  const prefix = native ? 'DUSK_NATIVE_PUBLIC_' : 'VITE_';
  const mode = env[prefix + 'DATA_MODE'] || 'demo';
  if (mode === 'demo') return { mode: 'demo' };
  if (mode !== 'backend' || (native && !localNative)) throw new Error('Backend configuration is unavailable for this build.');
  const url = env[prefix + 'SUPABASE_URL'];
  const publicKey = env[prefix + 'SUPABASE_PUBLISHABLE_KEY'];
  if (url !== 'http://127.0.0.1:55321' || typeof publicKey !== 'string') throw new Error('Invalid local backend configuration.');
  // Accept publishable keys or legacy anon JWTs only. A key is public, never an authorization boundary.
  let valid = /^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey);
  try {
    const payload = JSON.parse(atob(publicKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    valid ||= payload.role === 'anon' && publicKey.split('.').length === 3;
  } catch { /* Invalid legacy key. */ }
  if (!valid) throw new Error('A public Supabase client key is required.');
  return { mode: 'backend', url, publicKey };
}
