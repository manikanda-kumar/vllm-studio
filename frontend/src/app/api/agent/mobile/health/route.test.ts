import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/system/spawn", () => ({
  resolveExecutable: vi.fn((name: string) => {
    const found = new Set(["npx", "adb", "xcrun", "serve-sim", "mobilecli"]);
    return found.has(name);
  }),
}));

describe("/api/agent/mobile/health", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("returns expected shape with all booleans", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      nodeVersion: string;
      nodeVersionOk: boolean;
      npxFound: boolean;
      mobileMcpLaunchOk: boolean;
      mobileMcpVersion: string | null;
      adbFound: boolean;
      xcrunFound: boolean;
      serveSimFound: boolean;
      platform: string;
      supportedFeatures: Record<string, boolean>;
    };

    expect(typeof payload.nodeVersion).toBe("string");
    expect(typeof payload.nodeVersionOk).toBe("boolean");
    expect(typeof payload.npxFound).toBe("boolean");
    expect(typeof payload.mobileMcpLaunchOk).toBe("boolean");
    expect(typeof payload.mobileMcpVersion).toBe("string");
    expect(typeof payload.adbFound).toBe("boolean");
    expect(typeof payload.xcrunFound).toBe("boolean");
    expect(typeof payload.serveSimFound).toBe("boolean");
    expect(["darwin", "linux", "win32"]).toContain(payload.platform);
    expect(payload.supportedFeatures).toMatchObject({
      devices: expect.any(Boolean),
      screenshot: expect.any(Boolean),
      tap: expect.any(Boolean),
      button: expect.any(Boolean),
      boot: expect.any(Boolean),
      logs: expect.any(Boolean),
      stream: expect.any(Boolean),
    });
  });

  it("reports nodeVersionOk true when Node >= 22", async () => {
    const response = await GET();
    const payload = (await response.json()) as { nodeVersionOk: boolean };
    expect(payload.nodeVersionOk).toBe(true);
  });

  it("reports xcrunFound false on non-darwin", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const response = await GET();
    const payload = (await response.json()) as { xcrunFound: boolean; serveSimFound: boolean };
    expect(payload.xcrunFound).toBe(false);
    expect(payload.serveSimFound).toBe(false);
  });
});
