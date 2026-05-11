import { test, expect } from "@playwright/test";

test.describe("settings persistence", () => {
  let savedSettings: Record<string, unknown> = {};

  test.beforeEach(async ({ page }) => {
    savedSettings = {};
    await page.goto("/settings#connection");
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
    await page.waitForURL("/settings#connection");

    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "POST") {
        const body = await route.request().postDataJSON();
        savedSettings = { ...savedSettings, ...body, hasApiKey: Boolean(body.apiKey) };
        await route.fulfill({ status: 200, body: JSON.stringify(savedSettings) });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify(savedSettings) });
      }
    });
  });

  test("default model saves and re-loads", async ({ page }) => {
    const input = page.locator('input[placeholder="provider/model-id"]');
    await input.fill("openai/gpt-4o");

    const saveButton = page.locator('button', { hasText: /^Save$/ });
    await saveButton.click();

    // After save, reload and assert value persists
    await page.reload();
    await page.waitForURL("/settings#connection");
    await expect(input).toHaveValue("openai/gpt-4o");
  });

  test("api key store status flips from unset to stored", async ({ page }) => {
    // Initially unset
    await expect(page.locator('span', { hasText: "unset" }).first()).toBeVisible();

    const input = page.locator('div.relative input');
    await input.fill("test-api-key-123");

    const saveButton = page.locator('button', { hasText: /^Save$/ });
    await saveButton.click();

    // After save, status should show "stored"
    await expect(page.locator('span', { hasText: "stored" }).first()).toBeVisible();

    // Reload and verify mask placeholder
    await page.reload();
    await page.waitForURL("/settings#connection");
    const reloadedInput = page.locator('div.relative input');
    await expect(reloadedInput).toHaveAttribute("placeholder", "••••••••");
  });

  test("reveal hide API key toggles input type", async ({ page }) => {
    const input = page.locator('div.relative input');
    await expect(input).toHaveAttribute("type", "password");

    // Click reveal
    const revealButton = page.locator('button[aria-label="Reveal API key"]');
    await revealButton.click();

    await expect(input).toHaveAttribute("type", "text");

    // Click hide
    const hideButton = page.locator('button[aria-label="Hide API key"]');
    await hideButton.click();

    await expect(input).toHaveAttribute("type", "password");
  });

  test("theme change applies data-theme attribute", async ({ page }) => {
    await page.goto("/settings#appearance");
    await page.waitForURL("/settings#appearance");

    // Default theme is omlx-dark
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "omlx-dark");

    // Click "Use" on a non-default theme (omlx-light)
    const useButton = page.locator('button', { hasText: "Use" }).first();
    await useButton.click();

    // Assert theme changed
    await expect(html).toHaveAttribute("data-theme", "omlx-light");
  });
});
