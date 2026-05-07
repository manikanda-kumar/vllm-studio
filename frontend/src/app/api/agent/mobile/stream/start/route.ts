import { NextRequest } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamInfo = {
  url: string;
  streamUrl: string;
  wsUrl: string;
  port: number;
  device: string;
};

function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
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
    const body = (await request.json()) as { device?: string };
    const deviceId = body.device?.trim();
    if (!deviceId) {
      return Response.json({ error: "device is required" }, { status: 400 });
    }

    // Try serve-sim first (iOS simulators)
    const result = await runCommand("serve-sim", ["--detach", deviceId]);

    if (result.exitCode === 0) {
      try {
        const info = JSON.parse(result.stdout.trim()) as StreamInfo;
        return Response.json(info);
      } catch {
        return Response.json({ error: "Failed to parse serve-sim output" }, { status: 500 });
      }
    }

    // serve-sim not available or failed - return error with suggestion to use auto-refresh
    return Response.json(
      {
        error: "serve-sim not available. Use auto-refresh mode instead.",
        fallback: "auto-refresh"
      },
      { status: 404 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to start stream" },
      { status: 500 },
    );
  }
}
