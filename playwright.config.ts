import { defineConfig, devices } from "@playwright/test";

/**
 * NoxSend is an npm-workspaces monorepo; the dApp lives in `web/`.
 * These E2E tests run in DEMO MODE — no wallet, no env vars. They verify
 * what a first-time visitor sees before connecting (sealed pills, connect
 * prompts, meta tags, responsive layout) — never on-chain actions.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Build (if needed) + start the Next.js app from the web/ workspace.
    command: "npm run build:web && npm run start:web",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
