import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Temporary local prototype ID. Confirm a founder-owned ID before distribution.
  appId: "com.example.dusk.prototype",
  appName: "DUSK",
  webDir: "dist",
  // Explicit emulator-only build. Gradle refuses release tasks while this is copied.
  ...(process.env.DUSK_LOCAL_BACKEND === '1' ? { server: { androidScheme: 'http' } } : {}),
};

export default config;
