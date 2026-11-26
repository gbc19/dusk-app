import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from 'vite';
import { readBackendConfig } from './src/backend/config';
export default defineConfig(({ mode }) => {
  const native = mode.startsWith('native');
  const prefix = native ? 'DUSK_NATIVE_PUBLIC_' : 'VITE_';
  const env = loadEnv(mode, process.cwd(), prefix);
  for (const value of Object.values(env)) {
    let privateJwt = false;
    for (const jwt of value.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
      try { privateJwt ||= JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role !== 'anon'; } catch { privateJwt = true; }
    }
    if (privateJwt || /sb_secret_|postgres(?:ql)?:\/\//i.test(value)) throw new Error('Privileged values are forbidden in public build configuration.');
  }
  if (mode === 'native' && Object.keys(env).some(key => key.includes('SUPABASE') || (key.endsWith('DATA_MODE') && env[key] !== 'demo'))) throw new Error('Default native builds must use demo configuration. Use the explicit local debug workflow.');
  readBackendConfig(env, native, mode === 'native-local');
  if (mode === 'native-local' && env.DUSK_NATIVE_PUBLIC_DATA_MODE !== 'backend') throw new Error('Native local builds require explicit local backend configuration.');
  return {
  // The bundled prototype uses the list fallback. Keep website keys out of it.
  envPrefix: mode.startsWith("native") ? "DUSK_NATIVE_PUBLIC_" : "VITE_",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
  };
});
