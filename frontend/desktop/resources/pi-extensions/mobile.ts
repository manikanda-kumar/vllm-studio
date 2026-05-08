// Mobile device tool extension for vLLM Studio.
//
// Registers tools the agent can call to interact with connected mobile devices
// (Android emulators/devices, iOS simulators/devices). Each tool sends an HTTP
// request to the frontend's mobile API; the API runs mobilecli commands and
// returns results.
//
// Loaded by pi-runtime via `--extension` when mobile devices are available.

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

type ToolResult = {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  details: Record<string, unknown>;
};

const FRONTEND_BASE = process.env.VLLM_STUDIO_FRONTEND_BASE ?? "http://127.0.0.1:3000";

async function callMobileAction(
  endpoint: string,
  method: "GET" | "POST",
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  let url = `${FRONTEND_BASE}/api/agent/mobile/${endpoint}`;
  const init: RequestInit = { method, signal };

  if (method === "GET") {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    if (searchParams.toString()) url += `?${searchParams.toString()}`;
  } else {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(params);
  }

  const response = await fetch(url, init);

  // Handle binary screenshot response
  if (endpoint === "screenshot" && response.ok) {
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return {
      content: [{ type: "image", data: base64, mimeType: "image/png" }],
      details: { endpoint, params },
    };
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`mobile_${endpoint} failed: HTTP ${response.status} ${errBody}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  if (result.error) throw new Error(String(result.error));

  const text = JSON.stringify(result, null, 2);
  return {
    content: [{ type: "text", text }],
    details: { endpoint, params, data: result },
  };
}

export default function registerMobileExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "mobile_list_devices",
    label: "Mobile: List Devices",
    description:
      "List all connected mobile devices (Android emulators/devices, iOS simulators/devices). Returns device IDs, names, platforms, and states.",
    parameters: Type.Object({}),
    async execute(_id, _params, signal) {
      return callMobileAction("devices", "GET", {}, signal);
    },
  });

  pi.registerTool({
    name: "mobile_screenshot",
    label: "Mobile: Screenshot",
    description:
      "Capture a screenshot of a mobile device screen. Returns a PNG image. Use this to see what's currently displayed on the device.",
    parameters: Type.Object({
      device: Type.String({ description: "Device ID from mobile_list_devices" }),
    }),
    async execute(_id, params, signal) {
      return callMobileAction("screenshot", "GET", { device: params.device }, signal);
    },
  });

  pi.registerTool({
    name: "mobile_tap",
    label: "Mobile: Tap",
    description:
      "Tap at specific x,y coordinates on the mobile device screen. Use after taking a screenshot to determine tap locations.",
    parameters: Type.Object({
      device: Type.String({ description: "Device ID from mobile_list_devices" }),
      x: Type.Number({ description: "X coordinate to tap" }),
      y: Type.Number({ description: "Y coordinate to tap" }),
    }),
    async execute(_id, params, signal) {
      return callMobileAction(
        "tap",
        "POST",
        { device: params.device, x: params.x, y: params.y },
        signal,
      );
    },
  });

  pi.registerTool({
    name: "mobile_button",
    label: "Mobile: Press Button",
    description:
      "Press a hardware button on the mobile device. Common buttons: home, back, menu, power, volume_up, volume_down.",
    parameters: Type.Object({
      device: Type.String({ description: "Device ID from mobile_list_devices" }),
      button: Type.String({
        description: "Button name: home, back, menu, power, volume_up, volume_down",
      }),
    }),
    async execute(_id, params, signal) {
      return callMobileAction(
        "button",
        "POST",
        { device: params.device, button: params.button },
        signal,
      );
    },
  });

  pi.registerTool({
    name: "mobile_boot",
    label: "Mobile: Boot Device",
    description: "Boot/start a mobile emulator or simulator that is currently offline.",
    parameters: Type.Object({
      device: Type.String({ description: "Device ID from mobile_list_devices" }),
    }),
    async execute(_id, params, signal) {
      return callMobileAction("boot", "POST", { device: params.device }, signal);
    },
  });

  pi.registerTool({
    name: "mobile_logs",
    label: "Mobile: Get Logs",
    description:
      "Get recent device logs (logcat for Android, system log for iOS). Useful for debugging app crashes or errors.",
    parameters: Type.Object({
      device: Type.String({ description: "Device ID from mobile_list_devices" }),
      lines: Type.Optional(
        Type.Number({ description: "Number of recent log lines to return (default: 100)" }),
      ),
    }),
    async execute(_id, params, signal) {
      return callMobileAction(
        "logs",
        "GET",
        { device: params.device, lines: params.lines },
        signal,
      );
    },
  });
}
