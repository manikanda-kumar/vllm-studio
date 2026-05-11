import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const ARTIFACT_DIR = "test-artifacts/02-shell";

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  const path = `${ARTIFACT_DIR}/${name}.png`;
  await ensureDir(dirname(path));
  await page.screenshot({ path });
}

function isBenignError(text: string): boolean {
  // Controller is not running during the e2e harness, so a cluster of
  // network/parse errors are expected and intentionally allow-listed.
  if (text.includes("WebSocket connection failed")) return true;
  if (text.includes("ResizeObserver loop")) return true;
  if (text.includes("Failed to load resource: the server responded with a status of 404")) return true;
  if (text.includes('EventSource\'s response has a MIME type ("text/html") that is not "text/event-stream"')) return true;
  if (text.includes("Unexpected token '<'")) return true; // HTML 404 page parsed as JSON
  if (text.includes("Failed to load recipes")) return true;
  if (text.includes("Failed to load log sessions")) return true;
  if (text.includes("Failed to load")) return true; // generic controller-absent fetch failures
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
    // Default state has liteMode: true (which redirects "/" -> "/agent"). Force
    // full mode and reload so the dashboard + all workspace tabs are present.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "vllm-studio-state",
        JSON.stringify({ state: { liteMode: false }, version: 0 }),
      );
    });
    await page.goto("/");
  });

  test.afterEach(async () => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("renders dashboard", async ({ page }) => {
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.locator('aside nav a[title="Status"]')).toBeVisible();
    await screenshot(page, "dashboard");
  });

  // Workspace tabs that live in the sidebar `nav` (Settings is pinned in the
  // footer and Agent now lives inside the projects section, so neither is here).
  const navRoutes: Array<{ path: string; label: string }> = [
    { path: "/usage", label: "Usage" },
    { path: "/recipes", label: "Models" },
    { path: "/server", label: "Server" },
  ];

  for (const route of navRoutes) {
    test(`navigates to ${route.path}`, async ({ page }) => {
      const tabLink = page.locator(`aside nav a[title="${route.label}"]`);
      await expect(tabLink).toBeVisible();
      await tabLink.click();
      await expect(page).toHaveURL(route.path);
      // The sidebar tab stays mounted after navigation, proving no crash.
      await expect(page.locator(`aside nav a[title="${route.label}"]`)).toBeVisible();
      await screenshot(page, route.path.replace("/", "") || "root");
    });
  }

  test("navigates to /settings from the footer", async ({ page }) => {
    await expect(page.locator("aside")).toBeVisible();
    await page.locator('aside a[title="Settings"]').click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('nav[aria-label="Settings sections"]')).toBeVisible();
    await screenshot(page, "settings");
  });

  test("agent route renders the workspace", async ({ page }) => {
    await page.goto("/agent");
    await expect(page.getByTestId("agent-page")).toBeVisible();
    await screenshot(page, "agent");
  });

  test("legacy /configs redirects to /settings", async ({ page }) => {
    await page.goto("/configs");
    await page.waitForURL(/\/settings/);
    await screenshot(page, "configs-redirect");
  });
});
