import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { localStatus, root } from './local-backend.mjs';
const files = ['.env.backend.local', '.env.native-local.local'].map(name => resolve(root, name));
if (files.some(existsSync)) throw new Error('Local client configuration already exists. Review it manually; no file was overwritten.');
const status = localStatus();
const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
let valid = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '');
try { valid ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* Closed default. */ }
if (!valid) throw new Error('No public client key available. No configuration written.');
for (const [index, file] of files.entries()) {
  const prefix = index ? 'DUSK_NATIVE_PUBLIC_' : 'VITE_';
  writeFileSync(file, `${prefix}DATA_MODE=backend\n${prefix}SUPABASE_URL=http://127.0.0.1:55321\n${prefix}SUPABASE_PUBLISHABLE_KEY=${key}\n`, { flag: 'wx', mode: 0o600 });
}
console.log('Created two ignored local client configuration files using a public key only. No values printed.');
