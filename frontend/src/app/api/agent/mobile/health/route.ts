import { resolveExecutable } from "@/lib/system/spawn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nodeVersionOk(): boolean {
  const major = parseInt(process.versions.node.split(".")[0]!, 10);
  return major >= 22;
}

function canLaunchMobileMcp(): boolean {
  const envOverride = process.env.VLLM_STUDIO_MOBILE_MCP_BIN;
  if (envOverride) return true;
  // Check if npx is available so we can launch the pinned version
  return Boolean(resolveExecutable(process.platform === "win32" ? "npx.cmd" : "npx"));
}

export async function GET() {
  const platform = process.platform as "darwin" | "linux" | "win32";
  const nodeVersion = process.version;
  const nodeOk = nodeVersionOk();
  const npxFound = Boolean(resolveExecutable(process.platform === "win32" ? "npx.cmd" : "npx"));
  const mobileMcpLaunchOk = canLaunchMobileMcp();
  const adbFound = Boolean(resolveExecutable(process.platform === "win32" ? "adb.exe" : "adb"));
  const xcrunFound = platform === "darwin" && Boolean(resolveExecutable("xcrun"));
  const serveSimFound = platform === "darwin" && Boolean(resolveExecutable("serve-sim"));

  const supportedFeatures = {
    devices: mobileMcpLaunchOk,
    screenshot: mobileMcpLaunchOk,
    tap: mobileMcpLaunchOk,
    button: mobileMcpLaunchOk,
    boot: Boolean(resolveExecutable(process.platform === "win32" ? "mobilecli.exe" : "mobilecli")),
    logs: adbFound || xcrunFound,
    stream: serveSimFound,
  };

  return Response.json({
    nodeVersion,
    nodeVersionOk: nodeOk,
    npxFound,
    mobileMcpLaunchOk,
    mobileMcpVersion: mobileMcpLaunchOk ? "0.0.54" : null,
    adbFound,
    xcrunFound,
    serveSimFound,
    platform,
    supportedFeatures,
  });
}
