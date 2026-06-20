import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the public marketing surface. Runs against an already-running
 * dev server on :3210 (auth-gated app routes are out of scope).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3210",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
