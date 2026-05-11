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

test.describe("app shell", () => {
  const errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors.length = 0;
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Allow-list benign pre-existing errors
        if (text.includes("WebSocket connection failed")) return; // websocket retry is expected in dev
        if (text.includes("ResizeObserver loop")) return; // benign browser quirk
        errors.push(text);
      }
    });
  });

  test.afterEach(async () => {
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("renders dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByText("vLLM Studio").first()).toBeVisible();
    await screenshot(page, "dashboard");
  });

  test("navigates to each top-level route", async ({ page }) => {
    await page.goto("/");

    const routes = [
      { path: "/agent", label: "Agent", assert: () => expect(page.getByTestId("agent-page")).toBeVisible() },
      { path: "/recipes", label: "Models", assert: () => expect(page.getByRole("heading", { name: "Models" })).toBeVisible() },
      { path: "/logs", label: "Server", assert: () => expect(page.getByText("Select a log session to view")).toBeVisible() },
      { path: "/settings", label: "Settings", assert: () => expect(page.getByRole("heading", { name: "Settings" })).toBeVisible() },
      { path: "/usage", label: "Usage", assert: () => expect(page.getByText("Usage").first()).toBeVisible() },
    ];

    for (const route of routes) {
      await page.getByRole("link", { name: route.label }).click();
      await expect(page).toHaveURL(route.path);
      await route.assert();
      await screenshot(page, route.path.replace("/", "") || "root");
    }
  });

  test("legacy /configs redirects to /settings", async ({ page }) => {
    await page.goto("/configs");
    await expect(page).toHaveURL("/settings");
    await screenshot(page, "configs-redirect");
  });
});
