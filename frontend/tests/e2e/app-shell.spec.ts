import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const ARTIFACT_DIR = "test-artifacts/02-shell";

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function screenshot(page, name: string) {
  const path = `${ARTIFACT_DIR}/${name}.png`;
  await ensureDir(dirname(path));
  await page.screenshot({ path });
}

function isBenignError(text: string): boolean {
  // Websocket retry is expected when controller is not running
  if (text.includes("WebSocket connection failed")) return true;
  // ResizeObserver loop limit exceeded is a benign browser quirk
  if (text.includes("ResizeObserver loop")) return true;
  // 404s from /api/* when controller is absent during e2e harness check
  if (text.includes("Failed to load resource: the server responded with a status of 404"))
    return true;
  // EventSource fallback when SSE endpoint is absent
  if (text.includes('EventSource\'s response has a MIME type ("text/html") that is not "text/event-stream"'))
    return true;
  // API endpoints returning HTML 404 pages instead of JSON when controller is absent
  if (text.includes("Unexpected token '<'")) return true;
  if (text.includes("Failed to load recipes")) return true;
  if (text.includes("Failed to load log sessions")) return true;
  return false;
}

test.describe("app shell", () => {
  const errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors.length = 0;
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (isBenignError(text)) return;
        errors.push(text);
      }
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("vllm-studio-state", JSON.stringify({ state: { liteMode: false }, version: 0 }));
    });
    await page.reload();
  });

  test.afterEach(async () => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("renders dashboard", async ({ page }) => {
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByText("vLLM Studio").first()).toBeVisible();
    await screenshot(page, "dashboard");
  });

  const routes = [
    { path: "/agent", label: "Agent", assert: (page) => expect(page.getByTestId("agent-page")).toBeVisible() },
    { path: "/recipes", label: "Models", assert: (page) => expect(page.getByRole("heading", { name: "Models", exact: true }).first()).toBeVisible() },
    { path: "/logs", label: "Server", assert: (page) => expect(page.getByText("Select a log session to view")).toBeVisible() },
    { path: "/settings", label: "Settings", assert: (page) => expect(page.getByRole("heading", { name: "Settings" })).toBeVisible() },
    { path: "/usage", label: "Usage", assert: (page) => expect(page.getByText("Usage").first()).toBeVisible() },
  ];

  for (const route of routes) {
    test(`navigates to ${route.path}`, async ({ page }) => {
      await expect(page.locator("aside")).toBeVisible();
      await page.locator(`aside nav a[title="${route.label}"]`).click();
      await expect(page).toHaveURL(route.path);
      await route.assert(page);
      await screenshot(page, route.path.replace("/", "") || "root");
    });
  }

  test("legacy /configs redirects to /settings", async ({ page }) => {
    await page.goto("/configs");
    await page.waitForURL("/settings");
    await screenshot(page, "configs-redirect");
  });
});
