import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import { enhancedPath } from "@/lib/system/spawn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runMobileCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("mobilecli", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PATH: enhancedPath() },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `mobilecli exited with code ${code}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to run mobilecli: ${err.message}`));
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
    const output = await runMobileCli(["device", "boot", "--device", deviceId]);
    return Response.json({ success: true, output });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Boot failed" },
      { status: 500 },
    );
  }
}
