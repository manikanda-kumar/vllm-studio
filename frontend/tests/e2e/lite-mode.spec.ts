import { test, expect, type Page } from "@playwright/test";

// Workspace tabs in the desktop sidebar nav (excludes the pinned Settings footer
// and the ProjectsNavSection). All four are infra-oriented and hidden in lite mode.
const WORKSPACE_TABS = ["Status", "Usage", "Models", "Server"] as const;

test.describe("lite mode", () => {
  async function clearState(page: Page) {
    await page.evaluate(() => window.localStorage.clear());
  }

  async function setLiteMode(page: Page, lite: boolean) {
    await page.evaluate((value) => {
      const raw = localStorage.getItem("vllm-studio-state") || "{}";
      const parsed = JSON.parse(raw);
      const state = parsed.state || parsed || {};
      state.liteMode = value;
      localStorage.setItem(
        "vllm-studio-state",
        JSON.stringify({ state, version: parsed.version || 0 }),
      );
    }, lite);
  }

  async function visibleWorkspaceTabs(page: Page): Promise<string[]> {
    await expect(page.locator("aside")).toBeVisible();
    const present: string[] = [];
    for (const label of WORKSPACE_TABS) {
      if ((await page.locator(`aside nav a[title="${label}"]`).count()) > 0) present.push(label);
    }
    return present;
  }

  async function settingsSectionLabels(page: Page): Promise<string[]> {
    return page
      .locator('nav[aria-label="Settings sections"] button')
      .evaluateAll((els: HTMLElement[]) => els.map((el) => el.textContent?.trim() || ""));
  }

  async function toggleLiteMode(page: Page, mode: "lite" | "full") {
    await page.goto("/settings#appearance");
    await page.waitForURL(/\/settings/);
    await page
      .locator("button", { hasText: mode === "lite" ? "Lite (Agent)" : "Full (Infra)" })
      .click();
    await expect(
      page.locator("span", { hasText: mode === "lite" ? "lite" : "full" }).first(),
    ).toBeVisible();
  }

  test("lite mode hides workspace tabs by default", async ({ page }) => {
    await page.goto("/");
    await clearState(page); // default state has liteMode: true
    await page.reload();
    expect(await visibleWorkspaceTabs(page)).toEqual([]);
    // Settings stays reachable from the pinned footer even in lite mode.
    await expect(page.locator('aside a[title="Settings"]')).toBeVisible();
  });

  test("full mode shows all workspace tabs", async ({ page }) => {
    await page.goto("/");
    await setLiteMode(page, false);
    await page.reload();
    expect(await visibleWorkspaceTabs(page)).toEqual([...WORKSPACE_TABS]);
  });

  test("lite mode hides the infra settings section", async ({ page }) => {
    await page.goto("/settings");
    await clearState(page); // default lite
    await page.reload();
    await page.waitForURL(/\/settings/);
    const labels = await settingsSectionLabels(page);
    expect(labels).toContain("Connection");
    expect(labels).toContain("Appearance");
    expect(labels).toContain("Archived chats");
    expect(labels).toContain("Plugins");
    expect(labels).toContain("Skills");
    expect(labels).toContain("Setup");
    expect(labels).not.toContain("Engines / Services / System");
  });

  test("full mode shows the infra settings section", async ({ page }) => {
    await page.goto("/settings");
    await setLiteMode(page, false);
    await page.reload();
    await page.waitForURL(/\/settings/);
    const labels = await settingsSectionLabels(page);
    expect(labels).toContain("Engines / Services / System");
  });

  test("mode persists across reload", async ({ page }) => {
    await page.goto("/settings#appearance");
    await clearState(page);
    await toggleLiteMode(page, "full");
    await page.reload();
    await page.goto("/");
    expect(await visibleWorkspaceTabs(page)).toEqual([...WORKSPACE_TABS]);
  });

  test("switching back to lite restores the filter", async ({ page }) => {
    await page.goto("/");
    await setLiteMode(page, false);
    await page.reload();
    expect(await visibleWorkspaceTabs(page)).toEqual([...WORKSPACE_TABS]);

    await toggleLiteMode(page, "lite");
    await page.goto("/");
    expect(await visibleWorkspaceTabs(page)).toEqual([]);
    await expect(page.locator('aside a[title="Settings"]')).toBeVisible();
  });
});
