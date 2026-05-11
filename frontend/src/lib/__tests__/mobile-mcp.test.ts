import { describe, it, expect, vi, beforeEach } from "vitest";
import { MobileMcpClient } from "../mobile-mcp";

const mockConnect = vi.fn();
const mockClose = vi.fn();
const mockListTools = vi.fn();
const mockCallTool = vi.fn();

let transportCloseHandler: (() => void) | undefined;
let transportErrorHandler: ((err: Error) => void) | undefined;

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
    listTools: mockListTools,
    callTool: mockCallTool,
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => {
    const transport = {
      onclose: undefined as (() => void) | undefined,
      onerror: undefined as ((err: Error) => void) | undefined,
      close: vi.fn(),
    };
    Object.defineProperty(transport, "onclose", {
      set(fn) {
        transportCloseHandler = fn;
      },
      get() {
        return transportCloseHandler;
      },
    });
    Object.defineProperty(transport, "onerror", {
      set(fn) {
        transportErrorHandler = fn;
      },
      get() {
        return transportErrorHandler;
      },
    });
    return transport;
  }),
}));

describe("MobileMcpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transportCloseHandler = undefined;
    transportErrorHandler = undefined;
    mockListTools.mockResolvedValue({ tools: [] });
    mockConnect.mockResolvedValue(undefined);
  });

  it("getHealth reports ready:false before initialization", () => {
    const client = new MobileMcpClient();
    const health = client.getHealth();
    expect(health.ready).toBe(false);
    expect(health.toolCount).toBe(0);
    expect(health.version).toBeNull();
  });

  it("parallel ensureReady calls produce one spawn (start-lock)", async () => {
    const client = new MobileMcpClient();
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

    const p1 = client.ensureReady();
    const p2 = client.ensureReady();
    await Promise.all([p1, p2]);

    expect(StdioClientTransport).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("tap after transport close auto-reconnects", async () => {
    const client = new MobileMcpClient();
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    });

    await client.ensureReady();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // Simulate transport close
    if (transportCloseHandler) {
      transportCloseHandler();
    }

    // Health should now show not ready
    expect(client.getHealth().ready).toBe(false);

    await client.tap("device1", 100, 200);
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });

  it("getHealth reports ready:true and toolCount after initialization", async () => {
    const client = new MobileMcpClient();
    mockListTools.mockResolvedValue({ tools: [{ name: "tool1" }, { name: "tool2" }] });

    await client.ensureReady();

    const health = client.getHealth();
    expect(health.ready).toBe(true);
    expect(health.toolCount).toBe(2);
    expect(health.version).toBe("0.0.54");
    expect(health.lastError).toBeNull();
  });

  it("ensureReady resets stale client when ping fails", async () => {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const client = new MobileMcpClient();

    // First connect succeeds
    await client.ensureReady();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // Now simulate a ping failure on subsequent calls by making connect throw
    mockConnect.mockRejectedValueOnce(new Error("Connection refused"));

    // The ping inside ensureReady should fail, causing a reconnect attempt
    await expect(client.ensureReady()).rejects.toThrow("Connection refused");
    // Should have attempted to reconnect
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });

  it("stop closes client and transport gracefully", async () => {
    const client = new MobileMcpClient();
    await client.ensureReady();

    const healthBefore = client.getHealth();
    expect(healthBefore.ready).toBe(true);

    await client.stop();

    const healthAfter = client.getHealth();
    expect(healthAfter.ready).toBe(false);
    expect(healthAfter.toolCount).toBe(0);
    expect(mockClose).toHaveBeenCalled();
  });
});
