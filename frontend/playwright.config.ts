// CRITICAL
import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3210";

/**
 * Chat sessions are stored in the controller SQLite DB. For isolation, start the
 * controller with e.g. `VLLM_STUDIO_CHATS_DB=<repo>/frontend/.playwright/chats-e2e.db`
 * (see `tests/README.md`). `PLAYWRIGHT_BACKEND_URL` must point at that same process.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  reporter: [
    ["json", { outputFile: "test-artifacts/results.json" }],
    ["line"],
    ["html", { open: "never", outputFolder: "test-artifacts/playwright-report" }],
  ],
  outputDir: "test-artifacts/playwright-output",
  webServer: {
    command: "PORT=3210 npm run dev",
    url: "http://localhost:3210",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

