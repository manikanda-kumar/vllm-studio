import { NextRequest } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAndroidLogs(deviceId: string, lines: number): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn("adb", ["-s", deviceId, "logcat", "-d", "-t", String(lines), "*:W"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.on("close", () => {
      resolve(stdout.trim().split("\n").filter(Boolean));
    });
    proc.on("error", () => {
      resolve([]);
    });
  });
}

function getIosLogs(deviceId: string, lines: number): Promise<string[]> {
  return new Promise((resolve) => {
    // For iOS simulator, use simctl spawn to get recent logs
    const proc = spawn(
      "xcrun",
      ["simctl", "spawn", deviceId, "log", "show", "--last", "1m", "--style", "compact"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.on("close", () => {
      const allLines = stdout.trim().split("\n").filter(Boolean);
      resolve(allLines.slice(-lines));
    });
    proc.on("error", () => {
      resolve([]);
    });
    // Timeout after 3 seconds
    setTimeout(() => {
      proc.kill();
    }, 3000);
  });
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device")?.trim();
  const linesParam = request.nextUrl.searchParams.get("lines");
  const lines = linesParam ? Math.min(Math.max(parseInt(linesParam, 10) || 50, 1), 200) : 50;

  if (!deviceId) {
    return Response.json({ error: "device parameter required" }, { status: 400 });
  }

  try {
    // Detect platform from device ID pattern
    const isAndroid =
      deviceId.startsWith("emulator-") ||
      deviceId.match(/^[A-Z0-9]{10,}$/) ||
      deviceId.includes(":");

    const logs = isAndroid
      ? await getAndroidLogs(deviceId, lines)
      : await getIosLogs(deviceId, lines);

    return Response.json({ logs });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch logs", logs: [] },
      { status: 500 },
    );
  }
}
