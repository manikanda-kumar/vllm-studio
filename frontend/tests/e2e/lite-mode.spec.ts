import { test, expect, type Page } from "@playwright/test";

test.describe("lite mode", () => {
  async function clearState(page: Page) {
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  }

  async function setLiteMode(page: Page, lite: boolean) {
    await page.evaluate((value) => {
      const raw = localStorage.getItem("vllm-studio-state") || "{}";
      const parsed = JSON.parse(raw);
      const state = parsed.state || parsed || {};
      state.liteMode = value;
      localStorage.setItem("vllm-studio-state", JSON.stringify({ state, version: parsed.version || 0 }));
    }, lite);
  }

  async function getSidebarTabLabels(page: Page): Promise<string[]> {
    return page.locator('aside nav a[title]').evaluateAll(
      (elements: HTMLElement[]) => elements.map((el) => el.getAttribute('title') || '')
    );
  }

  async function getSettingsSectionLabels(page: Page): Promise<string[]> {
    return page.locator('aside nav button').evaluateAll(
      (elements: HTMLElement[]) => elements.map((el) => el.textContent?.trim() || '')
    );
  }

  async function toggleLiteMode(page: Page, mode: "lite" | "full") {
    await page.goto("/settings#appearance");
    await page.waitForURL("/settings#appearance");
    const button = page.locator('button', { hasText: mode === "lite" ? "Lite (Agent)" : "Full (Infra)" });
    await button.click();
    // Wait for the status pill to update
    await expect(page.locator('span', { hasText: mode === "lite" ? "lite" : "full" }).first()).toBeVisible();
  }

  test("lite mode hides infra tabs by default", async ({ page }) => {
    await page.goto("/");
    await clearState(page);
    await page.reload();
    const labels = await getSidebarTabLabels(page);
    expect(labels).toContain("Agent");
    expect(labels).toContain("Settings");
    expect(labels).not.toContain("Status");
    expect(labels).not.toContain("Usage");
    expect(labels).not.toContain("Models");
    expect(labels).not.toContain("Server");
  });

  test("full mode shows all 6 tabs", async ({ page }) => {
    await page.goto("/");
    await setLiteMode(page, false);
    await page.reload();
    const labels = await getSidebarTabLabels(page);
    expect(labels).toContain("Status");
    expect(labels).toContain("Usage");
    expect(labels).toContain("Agent");
    expect(labels).toContain("Models");
    expect(labels).toContain("Server");
    expect(labels).toContain("Settings");
  });

  test("lite mode hides infra settings sections", async ({ page }) => {
    await page.goto("/settings#appearance");
    await clearState(page);
    await page.reload();
    await page.waitForURL("/settings#appearance");
    // Default is lite mode; settings nav should only show lite sections
    const labels = await getSettingsSectionLabels(page);
    expect(labels).toContain("Connection");
    expect(labels).toContain("Providers");
    expect(labels).toContain("Appearance");
    expect(labels).toContain("Agent tools");
    expect(labels).not.toContain("Engines");
    expect(labels).not.toContain("Services");
    expect(labels).not.toContain("System");
  });

  test("mode persists across reload", async ({ page }) => {
    await page.goto("/settings#appearance");
    await clearState(page);
    await toggleLiteMode(page, "full");
    await page.reload();
    await page.goto("/");
    const labels = await getSidebarTabLabels(page);
    expect(labels).toContain("Status");
    expect(labels).toContain("Usage");
  });

  test("switching back to lite restores filter", async ({ page }) => {
    await page.goto("/");
    await setLiteMode(page, false);
    await page.reload();
    let labels = await getSidebarTabLabels(page);
    expect(labels).toContain("Status");

    await toggleLiteMode(page, "lite");
    await page.goto("/");
    labels = await getSidebarTabLabels(page);
    expect(labels).toContain("Agent");
    expect(labels).toContain("Settings");
    expect(labels).not.toContain("Status");
    expect(labels).not.toContain("Usage");
    expect(labels).not.toContain("Models");
    expect(labels).not.toContain("Server");
  });
});
