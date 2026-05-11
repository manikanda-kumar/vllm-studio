import { test, expect } from "@playwright/test";

test.describe("mobile panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/agent");
  });

  test("mobile health endpoint reports state", async ({ page }) => {
    const res = await page.request.get("/api/agent/mobile/health");
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("nodeVersionOk");
      expect(body).toHaveProperty("mobileMcpLaunchOk");
    }
  });

  test("shutdown route returns 200", async ({ page }) => {
    const res = await page.request.post("/api/agent/mobile/shutdown");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("ok");
  });
});
