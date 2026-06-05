import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config for the backend. The API runs via tsx (no build step);
// these settings only drive the unit + e2e test suites.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    globals: true,
  },
});
