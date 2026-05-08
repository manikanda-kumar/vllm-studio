// Mobile MCP client for vLLM Studio.
// Uses stdio-based MCP transport via @modelcontextprotocol/sdk.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createRequire } from "node:module";
import path from "node:path";
import { enhancedPath, npxLauncher } from "./system/spawn";

const PINNED_VERSION = "0.0.54";

function resolveLocalMobileMcp(): string | null {
  try {
    const req = createRequire(path.join(process.cwd(), "package.json"));
    return req.resolve("@mobilenext/mobile-mcp/lib/index.js");
  } catch {
    return null;
  }
}

type McpToolResult = {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
};

type HealthStatus = {
  ready: boolean;
  lastError: string | null;
  version: string | null;
  toolCount: number;
};

function resolveMobileMcpCommand(): { command: string; args: string[] } {
  const envOverride = process.env.VLLM_STUDIO_MOBILE_MCP_BIN;
  if (envOverride) {
    return { command: envOverride, args: [] };
  }

  const localPath = resolveLocalMobileMcp();
  if (localPath) {
    return { command: "node", args: [localPath] };
  }

  return {
    command: npxLauncher(),
    args: ["-y", `@mobilenext/mobile-mcp@${PINNED_VERSION}`],
  };
}

class MobileMcpClient {
  private transport: StdioClientTransport | null = null;
  private client: Client | null = null;
  private ready = false;
  private starting: Promise<void> | null = null;
  private lastError: string | null = null;
  private toolCount = 0;

  getHealth(): HealthStatus {
    return {
      ready: this.ready,
      lastError: this.lastError,
      version: this.ready ? PINNED_VERSION : null,
      toolCount: this.toolCount,
    };
  }

  async ensureReady(): Promise<Client> {
    if (this.ready && this.client) {
      return this.client;
    }

    if (this.starting) {
      await this.starting;
      if (!this.client) {
        throw new Error("mobile-mcp failed to initialize");
      }
      return this.client;
    }

    this.starting = this.doStart();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }

    if (!this.client) {
      throw new Error("mobile-mcp failed to initialize");
    }
    return this.client;
  }

  private async doStart(): Promise<void> {
    this.lastError = null;
    const { command, args } = resolveMobileMcpCommand();

    const transport = new StdioClientTransport({
      command,
      args,
      env: {
        ...process.env,
        PATH: enhancedPath(),
      },
      stderr: "pipe",
    });

    transport.onclose = () => {
      this.ready = false;
      this.transport = null;
      this.client = null;
    };

    transport.onerror = (err) => {
      this.lastError = err.message;
    };

    const client = new Client({ name: "vllm-studio-mobile", version: "0.2.1" });

    try {
      await client.connect(transport);
      const toolsResult = await client.listTools();
      this.toolCount = toolsResult.tools.length;
      this.transport = transport;
      this.client = client;
      this.ready = true;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      try {
        await transport.close();
      } catch {
        // ignore cleanup error
      }
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.ready = false;
    this.toolCount = 0;
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // ignore cleanup error
      }
      this.client = null;
    }
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // ignore cleanup error
      }
      this.transport = null;
    }
  }

  private async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    const client = await this.ensureReady();
    const result = await client.callTool({ name, arguments: args });

    if ("toolResult" in result) {
      return { content: [{ type: "text", text: JSON.stringify(result.toolResult) }] };
    }

    const content = result.content
      .map((c: { type: string; text?: string; data?: string; mimeType?: string }) => {
        if (c.type === "text" && c.text !== undefined) {
          return { type: "text" as const, text: c.text };
        }
        if (c.type === "image" && c.data !== undefined && c.mimeType !== undefined) {
          return { type: "image" as const, data: c.data, mimeType: c.mimeType };
        }
        return null;
      })
      .filter(Boolean) as McpToolResult["content"];
    return {
      content,
      isError: typeof result.isError === "boolean" ? result.isError : undefined,
    };
  }

  async listDevices(): Promise<McpToolResult> {
    return this.callTool("mobile_list_available_devices");
  }

  async takeScreenshot(deviceId: string): Promise<McpToolResult> {
    return this.callTool("mobile_take_screenshot", { device: deviceId });
  }

  async tap(deviceId: string, x: number, y: number): Promise<McpToolResult> {
    return this.callTool("mobile_click_on_screen_at_coordinates", { device: deviceId, x, y });
  }

  async pressButton(deviceId: string, button: string): Promise<McpToolResult> {
    const buttonMap: Record<string, string> = {
      home: "HOME",
      back: "BACK",
      menu: "MENU",
      power: "POWER",
      volume_up: "VOLUME_UP",
      volume_down: "VOLUME_DOWN",
    };
    const mapped = buttonMap[button.toLowerCase()] || button;
    return this.callTool("mobile_press_button", { device: deviceId, button: mapped });
  }

  async typeText(deviceId: string, text: string): Promise<McpToolResult> {
    return this.callTool("mobile_type_keys", { device: deviceId, text });
  }

  async getScreenSize(deviceId: string): Promise<McpToolResult> {
    return this.callTool("mobile_get_screen_size", { device: deviceId });
  }

  async listElements(deviceId: string): Promise<McpToolResult> {
    return this.callTool("mobile_list_elements_on_screen", { device: deviceId });
  }
}

const globalForMobile = globalThis as typeof globalThis & {
  __vllmStudioMobileMcpClient?: MobileMcpClient;
};

function getClient(): MobileMcpClient {
  if (!globalForMobile.__vllmStudioMobileMcpClient) {
    globalForMobile.__vllmStudioMobileMcpClient = new MobileMcpClient();
  }
  return globalForMobile.__vllmStudioMobileMcpClient;
}

export function getMobileMcpClient(): MobileMcpClient {
  return getClient();
}

export async function startMobileMcp(): Promise<void> {
  await getClient().ensureReady();
}

export async function stopMobileMcp(): Promise<void> {
  await getClient().stop();
  globalForMobile.__vllmStudioMobileMcpClient = undefined;
}

export { MobileMcpClient };
export type { McpToolResult, HealthStatus };

// Graceful shutdown: stop mobile-mcp child on process termination.
// This runs in the Next server process (not Electron main).
if (typeof process !== "undefined") {
  const gracefulShutdown = async () => {
    await stopMobileMcp();
    process.exit(0);
  };
  process.once("SIGTERM", gracefulShutdown);
  process.once("SIGINT", gracefulShutdown);
}
