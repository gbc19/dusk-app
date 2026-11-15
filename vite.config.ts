import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  // The bundled prototype uses the list fallback. Keep website keys out of it.
  envPrefix: mode === "native" ? "DUSK_NATIVE_PUBLIC_" : "VITE_",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
}));
