// Mobile MCP client for vLLM Studio.
// Manages mobile-mcp server process and provides typed API for mobile device tools.

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

const DEFAULT_PORT = 3456;
const STARTUP_TIMEOUT_MS = 10000;

type MobileMcpConfig = {
  port?: number;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: number;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: number;
};

type McpToolResult = {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: boolean;
};

class MobileMcpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private port: number;
  private baseUrl: string;
  private requestId = 0;
  private ready = false;

  constructor(config: MobileMcpConfig = {}) {
    super();
    this.port = config.port ?? DEFAULT_PORT;
    this.baseUrl = `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    if (this.process && !this.process.killed) {
      return; // Already running
    }

    // Check if mobile-mcp is already running on port
    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 0 }),
      });
      if (response.ok) {
        this.ready = true;
        return; // Already running externally
      }
    } catch {
      // Not running, start it
    }

    return new Promise((resolve, reject) => {
      const args = ["-y", "@mobilenext/mobile-mcp@latest", "--listen", String(this.port)];

      this.process = spawn("npx", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PATH: ["/opt/homebrew/bin", "/usr/local/bin", process.env.PATH].filter(Boolean).join(":"),
        },
      });

      let startupError = "";

      this.process.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        startupError += text;
        // Check for ready signal
        if (text.includes("listening") || text.includes("ready") || text.includes(String(this.port))) {
          this.ready = true;
        }
      });

      this.process.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        if (text.includes("listening") || text.includes("ready")) {
          this.ready = true;
        }
      });

      this.process.on("error", (err) => {
        reject(new Error(`Failed to start mobile-mcp: ${err.message}`));
      });

      this.process.on("exit", (code) => {
        this.ready = false;
        this.emit("exit", code);
      });

      // Wait for server to be ready
      const checkReady = async () => {
        const startTime = Date.now();
        while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
          try {
            const response = await fetch(`${this.baseUrl}/mcp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 0 }),
            });
            if (response.ok) {
              this.ready = true;
              resolve();
              return;
            }
          } catch {
            // Keep trying
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        reject(new Error(`mobile-mcp startup timeout. stderr: ${startupError}`));
      };

      void checkReady();
    });
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill("SIGKILL");
          }
          resolve();
        }, 5000);
        this.process?.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    this.process = null;
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  private async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    if (!this.ready) {
      throw new Error("mobile-mcp not ready");
    }

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name, arguments: args },
      id: ++this.requestId,
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`mobile-mcp HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as JsonRpcResponse;
    if (json.error) {
      throw new Error(`mobile-mcp error: ${json.error.message}`);
    }

    return json.result as McpToolResult;
  }

  async listDevices(): Promise<McpToolResult> {
    return this.callTool("mobile_list_available_devices");
  }

  async takeScreenshot(deviceId: string): Promise<McpToolResult> {
    return this.callTool("mobile_take_screenshot", { deviceId });
  }

  async tap(deviceId: string, x: number, y: number): Promise<McpToolResult> {
    return this.callTool("mobile_click_on_screen_at_coordinates", { deviceId, x, y });
  }

  async pressButton(deviceId: string, button: string): Promise<McpToolResult> {
    // Map button names to mobile-mcp format
    const buttonMap: Record<string, string> = {
      home: "HOME",
      back: "BACK",
      menu: "MENU",
      power: "POWER",
      volume_up: "VOLUME_UP",
      volume_down: "VOLUME_DOWN",
    };
    return this.callTool("mobile_press_button", { deviceId, button: buttonMap[button.toLowerCase()] || button });
  }

  async typeText(deviceId: string, text: string): Promise<McpToolResult> {
    return this.callTool("mobile_type_keys", { deviceId, text });
  }

  async getScreenSize(deviceId: string): Promise<McpToolResult> {
    return this.callTool("mobile_get_screen_size", { deviceId });
  }

  async listElements(deviceId: string): Promise<McpToolResult> {
    return this.callTool("mobile_list_elements_on_screen", { deviceId });
  }
}

// Singleton instance
let client: MobileMcpClient | null = null;

export function getMobileMcpClient(): MobileMcpClient {
  if (!client) {
    client = new MobileMcpClient();
  }
  return client;
}

export async function startMobileMcp(): Promise<void> {
  const c = getMobileMcpClient();
  await c.start();
}

export async function stopMobileMcp(): Promise<void> {
  if (client) {
    await client.stop();
    client = null;
  }
}

export { MobileMcpClient };
