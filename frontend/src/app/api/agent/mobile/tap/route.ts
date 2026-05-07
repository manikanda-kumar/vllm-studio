import { NextRequest } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const body = (await request.json()) as { device?: string; x?: number; y?: number };
    const deviceId = body.device?.trim();
    const x = body.x;
    const y = body.y;

    if (!deviceId) {
      return Response.json({ error: "device is required" }, { status: 400 });
    }
    if (typeof x !== "number" || typeof y !== "number") {
      return Response.json({ error: "x and y coordinates are required" }, { status: 400 });
    }

    const result = await runMobileCli(["io", "tap", "--device", deviceId, `${x},${y}`]);

    if (result.exitCode !== 0) {
      return Response.json(
        { error: result.stderr || `Tap failed (exit ${result.exitCode})` },
        { status: 500 },
      );
    }

    return Response.json({ success: true, x, y });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Tap failed" },
      { status: 500 },
    );
  }
}
