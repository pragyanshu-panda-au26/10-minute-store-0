import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the e2e suite. Runs against a locally-running dev
 * server (npm run dev). Add `.env.test` to keep test-only env vars separate
 * from `.env`; at minimum:
 *
 *   TEST_PHONE_NUMBERS="+919999999999"
 *   DEV_OTP_MASTER_CODE="123456"
 *
 * The test-phone allowlist means the sign-in flow works without a real SMS
 * round-trip AND without needing `ALLOW_MASTER_OTP=1`, so the same config
 * works in local dev and in CI.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // shared DB state — keep sequential for now
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  timeout: 60_000,
  expect: { timeout: 10_000 },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Boots the app if the caller didn't already. Reuse an existing server
  // when one is running so `npm run dev` in one terminal + `npm run test:e2e`
  // in another Just Works.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
