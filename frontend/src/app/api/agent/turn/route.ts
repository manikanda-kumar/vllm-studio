import { NextRequest } from "next/server";
import { listSessions } from "@/lib/agent/sessions-store";
import { piRuntimeManager } from "@/lib/agent/pi-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TurnRequest = {
  sessionId?: string;
  modelId?: string;
  message?: string;
  cwd?: string;
  // Optional pi session UUID to resume a past conversation. Distinct from
  // `sessionId`, which is the in-memory PiRpcSession key (one per browser tab).
  piSessionId?: string | null;
  // When true, pi-runtime loads the browser extension so the agent can drive
  // the embedded webview via tool calls.
  browserToolEnabled?: boolean;
  // Send mode (matches pi-mono RPC): "prompt" runs immediately (or queues with
  // streamingBehavior), "steer" interrupts the current turn between tool
  // executions and the next LLM call, "follow_up" waits for the agent to
  // finish before being delivered.
  mode?: "prompt" | "steer" | "follow_up";
  streamingBehavior?: "steer" | "followUp";
};

const FILE_WRITE_TOOL_NAMES = new Set([
  "write_file",
  "write",
  "create_file",
  "edit_file",
  "edit",
  "apply_patch",
  "apply_edit",
  "replace_file",
  "str_replace_editor",
]);

const VERIFY_TOOL_NAMES = new Set([
  "verify_web",
  "verify_mobile",
  "verify_responsive",
  "verify_until_pass",
]);

// Path globs that imply mobile-related verification rather than web.
const MOBILE_PATH_PATTERNS = [
  /\bmobile-/i,
  /\bmobilecli\b/i,
  /\bmobile-mcp\b/i,
  /\/api\/agent\/mobile\//i,
];

function classifyDirtyPath(p: string): "mobile" | "web" {
  return MOBILE_PATH_PATTERNS.some((re) => re.test(p)) ? "mobile" : "web";
}

function extractToolCallPath(toolCall: unknown): string | null {
  if (!toolCall || typeof toolCall !== "object") return null;
  const args = (toolCall as { arguments?: unknown }).arguments;
  if (!args || typeof args !== "object") return null;
  for (const key of ["path", "file_path", "filePath", "file"]) {
    const v = (args as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function sse(controller: ReadableStreamDefaultController<Uint8Array>, payload: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export async function POST(request: NextRequest) {
  let body: TurnRequest;
  try {
    body = (await request.json()) as TurnRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : "default";
  const cwd = typeof body.cwd === "string" && body.cwd.trim() ? body.cwd.trim() : undefined;
  const piSessionId =
    typeof body.piSessionId === "string" && body.piSessionId.trim()
      ? body.piSessionId.trim()
      : null;
  const browserToolEnabled = body.browserToolEnabled === true;
  const mode: TurnRequest["mode"] =
    body.mode === "steer" || body.mode === "follow_up" ? body.mode : "prompt";
  const streamingBehavior =
    body.streamingBehavior === "steer" || body.streamingBehavior === "followUp"
      ? body.streamingBehavior
      : undefined;

  if (!message) return Response.json({ error: "message is required" }, { status: 400 });
  if (!modelId) return Response.json({ error: "modelId is required" }, { status: 400 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Auto-verify state for this turn. Populated by intercepting pi events
      // emitted during session.prompt(). The pendingTools map carries the
      // tool name + path between the assistant_message_event (which has args
      // but not the success state) and the tool_execution_end (which has
      // success state but only the toolCallId).
      const pendingTools = new Map<string, { name: string; path: string | null }>();
      const dirtyWebPaths: string[] = [];
      const dirtyMobilePaths: string[] = [];
      let verifyWasCalled = false;

      const observe = (event: Record<string, unknown>): void => {
        const type = String((event as { type?: unknown }).type ?? "");
        if (type === "assistant_message_event") {
          const ame = (event as { assistantMessage?: Record<string, unknown> }).assistantMessage;
          const update = ame?.update as { type?: string } | undefined;
          if (update?.type === "toolcall_end") {
            const toolCall = ame?.toolCall as
              | { id?: string; name?: string; arguments?: unknown }
              | undefined;
            if (toolCall?.id && toolCall?.name) {
              pendingTools.set(toolCall.id, {
                name: toolCall.name,
                path: extractToolCallPath(toolCall),
              });
              if (VERIFY_TOOL_NAMES.has(toolCall.name)) verifyWasCalled = true;
            }
          }
        } else if (type === "tool_execution_end") {
          const id = String((event as { toolCallId?: unknown }).toolCallId ?? "");
          const isError = (event as { isError?: unknown }).isError === true;
          const tracked = id ? pendingTools.get(id) : undefined;
          if (tracked && !isError && FILE_WRITE_TOOL_NAMES.has(tracked.name) && tracked.path) {
            const bucket = classifyDirtyPath(tracked.path);
            if (bucket === "mobile") dirtyMobilePaths.push(tracked.path);
            else dirtyWebPaths.push(tracked.path);
          }
        }
      };

      try {
        const turnStartedAt = new Date(Date.now() - 2_000);
        const session = piRuntimeManager.getSession(sessionId);
        const existingStatus = session.status;
        const effectivePiSessionId =
          mode === "prompt"
            ? piSessionId
            : existingStatus.running
              ? (existingStatus.piSessionId ?? piSessionId)
              : piSessionId;
        sse(controller, { type: "status", phase: "starting", sessionId, modelId, cwd });
        await session.ensureStarted(modelId, cwd, effectivePiSessionId, browserToolEnabled);
        sse(controller, { type: "status", phase: "running", session: session.status });
        if (mode === "steer") {
          await session.steer(message);
          // Steer is a fire-and-forget control message — events keep flowing on
          // the original prompt's stream. Close ours immediately.
          sse(controller, { type: "status", phase: "queued", queue: "steer" });
        } else if (mode === "follow_up") {
          await session.followUp(message);
          sse(controller, { type: "status", phase: "queued", queue: "follow_up" });
        } else {
          await session.prompt(
            message,
            (event) => {
              observe(event as Record<string, unknown>);
              sse(controller, { type: "pi", event });
            },
            { streamingBehavior },
          );
        }
        // Auto-verify safety net: only fires for `prompt` mode. If the agent
        // edited files but never called a verify_* tool, run a second pi
        // prompt that forces verification. This is the runtime guarantee
        // behind the system-prompt addendum injected by pi-runtime.
        if (
          mode === "prompt" &&
          !verifyWasCalled &&
          (dirtyWebPaths.length > 0 || dirtyMobilePaths.length > 0)
        ) {
          sse(controller, {
            type: "auto_verify",
            phase: "injecting",
            webPaths: dirtyWebPaths,
            mobilePaths: dirtyMobilePaths,
          });
          const lines: string[] = [
            "[vLLM Studio auto-verify] You edited files this turn but did not call any verify_* tool.",
            "Per built-in policy, verify the change now before this turn closes.",
            "",
          ];
          if (dirtyWebPaths.length > 0) {
            lines.push(
              `Web-relevant files edited: ${dirtyWebPaths.slice(0, 10).join(", ")}`,
              "→ Call verify_web with url=http://127.0.0.1:3000 (or the relevant local URL) and checks=['screenshot']. Inspect the screenshot.",
              "",
            );
          }
          if (dirtyMobilePaths.length > 0) {
            lines.push(
              `Mobile-relevant files edited: ${dirtyMobilePaths.slice(0, 10).join(", ")}`,
              "→ Call mobile_list_devices, then verify_mobile against the first available device with actions=['screenshot']. If state is offline, set boot=true.",
              "",
            );
          }
          lines.push(
            "Report the verification outcome briefly. Do not ask for confirmation — just verify, then summarize.",
          );
          try {
            await session.prompt(
              lines.join("\n"),
              (event) => {
                sse(controller, { type: "pi", event });
              },
              {},
            );
            sse(controller, { type: "auto_verify", phase: "done" });
          } catch (err) {
            sse(controller, {
              type: "auto_verify",
              phase: "error",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        const status = session.status;
        let resolvedPiSessionId = status.piSessionId;
        if (!resolvedPiSessionId && status.cwd) {
          const recent = await listSessions(status.cwd, { since: turnStartedAt });
          resolvedPiSessionId = recent[0]?.id ?? null;
        }
        sse(controller, { type: "status", phase: "done", piSessionId: resolvedPiSessionId });
      } catch (error) {
        sse(controller, {
          type: "error",
          error: error instanceof Error ? error.message : "Pi agent turn failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
