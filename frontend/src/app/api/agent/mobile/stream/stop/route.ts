import { NextRequest } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runCommand(cmd: string, args: string[]): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1 });
    });
    proc.on("error", () => {
      resolve({ exitCode: 1 });
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { device?: string };
    const deviceId = body.device?.trim();

    // Kill serve-sim for specific device or all
    const args = deviceId ? ["--kill", deviceId] : ["--kill"];
    await runCommand("serve-sim", args);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to stop stream" },
      { status: 500 },
    );
  }
}
