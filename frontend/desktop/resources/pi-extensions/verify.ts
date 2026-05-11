// Verification tool extension for vLLM Studio.
//
// Registers built-in tools the agent uses to verify its own work after edits:
// `verify_web` drives the embedded browser, `verify_mobile` drives a connected
// device, `verify_responsive` sweeps a URL across viewports, and
// `verify_until_pass` runs an iterative grind loop whose transcript the model
// self-evaluates against free-form success criteria.
//
// Auto-loaded by pi-runtime as a built-in extension for post-edit verification;
// no user opt-in required.

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

type ToolResult = {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  details: Record<string, unknown>;
};

const FRONTEND_BASE = process.env.VLLM_STUDIO_FRONTEND_BASE ?? "http://127.0.0.1:3000";

async function callBrowserAction(
  verb: string,
  payload: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  const response = await fetch(`${FRONTEND_BASE}/api/agent/browser/${verb}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`browser_${verb} failed: HTTP ${response.status} ${errBody}`);
  }
  const result = (await response.json()) as { ok: boolean; data?: unknown; error?: string };
  if (!result.ok) throw new Error(result.error || `browser_${verb} failed`);
  const text = typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2);
  return {
    content: [{ type: "text", text }],
    details: { verb, payload, data: result.data },
  };
}

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

// Internal helper for verify_web; also reused by verify_until_pass.
async function runVerifyWeb(
  url: string,
  checks: string[],
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  const perCheck: Record<string, "ok" | "error"> = {};
  const summaryLines: string[] = [];
  const content: ToolResult["content"] = [];

  try {
    await callBrowserAction("navigate", { url }, signal);
    summaryLines.push(`navigate ${url}: ok`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summaryLines.push(`navigate ${url}: error ${message}`);
    content.push({ type: "text", text: summaryLines.join("\n") });
    return {
      content,
      details: { url, checks, perCheck, navigateError: message },
    };
  }

  for (const check of checks) {
    if (check === "screenshot") {
      try {
        const result = await callBrowserAction("screenshot", {}, signal);
        // The screenshot endpoint returns JSON { ok, data } where data is a
        // base64 data URI like "data:image/png;base64,...". Strip the prefix
        // before emitting an image content item.
        const dataField = (result.details as { data?: unknown }).data;
        if (typeof dataField === "string" && dataField.startsWith("data:image/png;base64,")) {
          const base64 = dataField.slice("data:image/png;base64,".length);
          content.push({ type: "image", data: base64, mimeType: "image/png" });
          perCheck.screenshot = "ok";
          summaryLines.push("screenshot: ok");
        } else {
          perCheck.screenshot = "error";
          summaryLines.push("screenshot: error (could not parse data URI)");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        perCheck.screenshot = "error";
        summaryLines.push(`screenshot: error ${message}`);
      }
    } else if (check === "console") {
      // NOTE: get-text is a stand-in until a real console-log endpoint exists.
      try {
        const result = await callBrowserAction("get-text", {}, signal);
        const text = (result.content[0] as { text?: string } | undefined)?.text ?? "";
        perCheck.console = "ok";
        summaryLines.push(`console (get-text stand-in): ok (${text.length} chars)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        perCheck.console = "error";
        summaryLines.push(`console: error ${message}`);
      }
    } else if (check === "network") {
      // NOTE: get-text is a stand-in until a real network-log endpoint exists.
      try {
        const result = await callBrowserAction("get-text", {}, signal);
        const text = (result.content[0] as { text?: string } | undefined)?.text ?? "";
        perCheck.network = "ok";
        summaryLines.push(`network (get-text stand-in): ok (${text.length} chars)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        perCheck.network = "error";
        summaryLines.push(`network: error ${message}`);
      }
    } else if (check === "a11y") {
      // a11y tree comes from DOM via get-html.
      try {
        const result = await callBrowserAction("get-html", {}, signal);
        const text = (result.content[0] as { text?: string } | undefined)?.text ?? "";
        perCheck.a11y = "ok";
        summaryLines.push(`a11y (from get-html): ok (${text.length} chars)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        perCheck.a11y = "error";
        summaryLines.push(`a11y: error ${message}`);
      }
    } else {
      perCheck[check] = "error";
      summaryLines.push(`${check}: error (unknown check)`);
    }
  }

  content.unshift({ type: "text", text: summaryLines.join("\n") });
  return {
    content,
    details: { url, checks, perCheck },
  };
}

// Internal helper for verify_mobile; also reused by verify_until_pass.
async function runVerifyMobile(
  device: string,
  actions: string[],
  boot: boolean,
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  const perAction: Record<string, "ok" | "error"> = {};
  const summaryLines: string[] = [];
  const content: ToolResult["content"] = [];

  if (boot) {
    try {
      await callMobileAction("boot", "POST", { device }, signal);
      summaryLines.push(`boot ${device}: ok`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summaryLines.push(`boot ${device}: error ${message}`);
    }
  }

  for (const action of actions) {
    if (action === "screenshot") {
      try {
        const result = await callMobileAction("screenshot", "GET", { device }, signal);
        for (const item of result.content) content.push(item);
        perAction.screenshot = "ok";
        summaryLines.push("screenshot: ok");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        perAction.screenshot = "error";
        summaryLines.push(`screenshot: error ${message}`);
      }
    } else if (action === "logs") {
      try {
        const result = await callMobileAction("logs", "GET", { device, lines: 100 }, signal);
        const text = (result.content[0] as { text?: string } | undefined)?.text ?? "";
        summaryLines.push(`logs: ok\n${text}`);
        perAction.logs = "ok";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        perAction.logs = "error";
        summaryLines.push(`logs: error ${message}`);
      }
    } else {
      perAction[action] = "error";
      summaryLines.push(`${action}: error (unknown action)`);
    }
  }

  content.unshift({ type: "text", text: summaryLines.join("\n") });
  return {
    content,
    details: { device, actions, boot, perAction },
  };
}

type Breakpoint = { name: string; width: number; height: number };

const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function runVerifyResponsive(
  url: string,
  breakpoints: Breakpoint[],
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  const content: ToolResult["content"] = [];
  const summaryLines: string[] = [
    `Responsive verify for ${url} across ${breakpoints.length} breakpoint(s).`,
    "Note: viewport resize is best-effort; no resize endpoint exists yet, so each",
    "screenshot is captured at the embedded browser's current viewport.",
  ];
  // TODO: wire a real /api/agent/browser/resize endpoint and call it here per breakpoint.

  try {
    await callBrowserAction("navigate", { url }, signal);
    summaryLines.push(`navigate ${url}: ok`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summaryLines.push(`navigate ${url}: error ${message}`);
    content.push({ type: "text", text: summaryLines.join("\n") });
    return {
      content,
      details: { url, breakpoints, navigateError: message },
    };
  }

  const perBreakpoint: Record<string, "ok" | "error"> = {};
  for (const bp of breakpoints) {
    const label = `### ${bp.name} (${bp.width}x${bp.height})`;
    try {
      const result = await callBrowserAction("screenshot", {}, signal);
      const dataField = (result.details as { data?: unknown }).data;
      if (typeof dataField === "string" && dataField.startsWith("data:image/png;base64,")) {
        const base64 = dataField.slice("data:image/png;base64,".length);
        content.push({ type: "text", text: label });
        content.push({ type: "image", data: base64, mimeType: "image/png" });
        perBreakpoint[bp.name] = "ok";
      } else {
        content.push({ type: "text", text: `${label}\nerror: could not parse data URI` });
        perBreakpoint[bp.name] = "error";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      content.push({ type: "text", text: `${label}\nerror: ${message}` });
      perBreakpoint[bp.name] = "error";
    }
  }

  content.unshift({ type: "text", text: summaryLines.join("\n") });
  return {
    content,
    details: { url, breakpoints, perBreakpoint },
  };
}

export default function registerVerifyExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "verify_web",
    label: "Verify: Web",
    description:
      "Verify a web page in the embedded browser. Navigates to the URL and runs the requested checks (screenshot, console, network, a11y).",
    parameters: Type.Object({
      url: Type.String({ description: "Absolute http(s) URL to verify" }),
      checks: Type.Optional(
        Type.Array(
          Type.Union([
            Type.Literal("screenshot"),
            Type.Literal("console"),
            Type.Literal("network"),
            Type.Literal("a11y"),
          ]),
          { description: "Checks to run; defaults to ['screenshot']" },
        ),
      ),
    }),
    async execute(_id, params, signal) {
      const checks =
        Array.isArray(params.checks) && params.checks.length > 0 ? params.checks : ["screenshot"];
      return runVerifyWeb(params.url, checks, signal);
    },
  });

  pi.registerTool({
    name: "verify_mobile",
    label: "Verify: Mobile",
    description:
      "Verify a mobile device. Optionally boots the device, then performs the requested actions (screenshot, logs).",
    parameters: Type.Object({
      device: Type.String({ description: "Device ID from mobile_list_devices" }),
      actions: Type.Optional(
        Type.Array(Type.Union([Type.Literal("screenshot"), Type.Literal("logs")]), {
          description: "Actions to run; defaults to ['screenshot']",
        }),
      ),
      boot: Type.Optional(
        Type.Boolean({ description: "If true, boot the device first (default: false)" }),
      ),
    }),
    async execute(_id, params, signal) {
      const actions =
        Array.isArray(params.actions) && params.actions.length > 0
          ? params.actions
          : ["screenshot"];
      const boot = params.boot === true;
      return runVerifyMobile(params.device, actions, boot, signal);
    },
  });

  pi.registerTool({
    name: "verify_responsive",
    label: "Verify: Responsive",
    description:
      "Run verify_web across multiple viewports. Captures one screenshot per breakpoint and labels each.",
    parameters: Type.Object({
      url: Type.String({ description: "Absolute http(s) URL to verify" }),
      breakpoints: Type.Optional(
        Type.Array(
          Type.Object({
            name: Type.String(),
            width: Type.Number(),
            height: Type.Number(),
          }),
          {
            description:
              "Viewports to check; defaults to mobile/tablet/desktop (375x667, 768x1024, 1440x900)",
          },
        ),
      ),
    }),
    async execute(_id, params, signal) {
      const breakpoints =
        Array.isArray(params.breakpoints) && params.breakpoints.length > 0
          ? (params.breakpoints as Breakpoint[])
          : DEFAULT_BREAKPOINTS;
      return runVerifyResponsive(params.url, breakpoints, signal);
    },
  });

  pi.registerTool({
    name: "verify_until_pass",
    label: "Verify: Until Pass",
    description:
      "Iterative verification grind. Runs verify_web or verify_mobile up to max_iters times and returns the full transcript so the model can self-evaluate against success_criteria.",
    parameters: Type.Object({
      target: Type.Union([Type.Literal("web"), Type.Literal("mobile")], {
        description: "Which verifier to drive each iteration",
      }),
      url: Type.Optional(Type.String({ description: "URL to verify when target='web'" })),
      device: Type.Optional(
        Type.String({ description: "Device ID to verify when target='mobile'" }),
      ),
      max_iters: Type.Optional(
        Type.Number({ description: "Maximum iterations to run (default: 3)" }),
      ),
      success_criteria: Type.String({
        description:
          "Free-form description of what 'passing' looks like. Echoed back so the model can self-evaluate the transcript.",
      }),
    }),
    async execute(_id, params, signal) {
      const target = params.target as "web" | "mobile";
      const maxIters =
        typeof params.max_iters === "number" && params.max_iters > 0
          ? Math.floor(params.max_iters)
          : 3;
      const successCriteria = String(params.success_criteria ?? "");

      if (target === "web" && !params.url) {
        throw new Error("verify_until_pass: 'url' is required when target='web'");
      }
      if (target === "mobile" && !params.device) {
        throw new Error("verify_until_pass: 'device' is required when target='mobile'");
      }

      const transcript: string[] = [];
      const aggregated: ToolResult["content"] = [];
      let completedIters = 0;

      for (let i = 1; i <= maxIters; i++) {
        transcript.push(`--- iteration ${i}/${maxIters} ---`);
        try {
          const result =
            target === "web"
              ? await runVerifyWeb(params.url as string, ["screenshot"], signal)
              : await runVerifyMobile(params.device as string, ["screenshot"], false, signal);
          for (const item of result.content) {
            if (item.type === "text") transcript.push(item.text);
            else aggregated.push(item);
          }
          completedIters = i;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          transcript.push(`iteration ${i} threw: ${message}`);
          completedIters = i;
          break;
        }
      }

      transcript.push(`Iterations: ${completedIters} | success_criteria: ${successCriteria}`);
      const text = transcript.join("\n");
      const content: ToolResult["content"] = [{ type: "text", text }, ...aggregated];
      return {
        content,
        details: {
          target,
          url: params.url,
          device: params.device,
          max_iters: maxIters,
          completed_iters: completedIters,
          success_criteria: successCriteria,
        },
      };
    },
  });
}
