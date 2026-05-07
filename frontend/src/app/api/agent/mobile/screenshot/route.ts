import { NextRequest } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function captureScreenshot(deviceId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("mobilecli", ["screenshot", "--device", deviceId, "--output", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(stderr || `mobilecli screenshot exited with code ${code}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to run mobilecli: ${err.message}`));
    });
  });
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device")?.trim();
  if (!deviceId) {
    return Response.json({ error: "device parameter required" }, { status: 400 });
  }
  try {
    const imageBuffer = await captureScreenshot(deviceId);
    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Screenshot failed" },
      { status: 500 },
    );
  }
}
