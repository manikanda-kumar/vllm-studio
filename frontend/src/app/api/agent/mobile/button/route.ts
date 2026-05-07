import { NextRequest } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_BUTTONS = new Set([
  "HOME",
  "BACK",
  "POWER",
  "VOLUME_UP",
  "VOLUME_DOWN",
  "ENTER",
  "DPAD_UP",
  "DPAD_DOWN",
  "DPAD_LEFT",
  "DPAD_RIGHT",
  "DPAD_CENTER",
]);

function runMobileCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("mobilecli", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
    proc.on("error", (err) => {
      resolve({ stdout: "", stderr: err.message, exitCode: 1 });
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { device?: string; button?: string };
    const deviceId = body.device?.trim();
    const button = body.button?.trim().toUpperCase();

    if (!deviceId) {
      return Response.json({ error: "device is required" }, { status: 400 });
    }
    if (!button) {
      return Response.json({ error: "button is required" }, { status: 400 });
    }
    if (!VALID_BUTTONS.has(button)) {
      return Response.json(
        { error: `Invalid button. Valid: ${[...VALID_BUTTONS].join(", ")}` },
        { status: 400 },
      );
    }

    const result = await runMobileCli(["io", "button", "--device", deviceId, button]);

    if (result.exitCode !== 0) {
      return Response.json(
        { error: result.stderr || `Button press failed (exit ${result.exitCode})` },
        { status: 500 },
      );
    }

    return Response.json({ success: true, button });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Button press failed" },
      { status: 500 },
    );
  }
}
