import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MobileDevice = {
  id: string;
  name: string;
  platform: "ios" | "android";
  type: "real" | "emulator" | "simulator";
  state: "online" | "offline";
};

function runMobileCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
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

export async function GET() {
  try {
    const output = await runMobileCli(["devices", "--include-offline"]);
    const devices = JSON.parse(output) as MobileDevice[];
    return Response.json({ devices });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to list devices", devices: [] },
      { status: 500 },
    );
  }
}
