import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawnSync } from "node:child_process";

const NODE_MAJOR = parseInt(process.versions.node.split(".")[0]!, 10);
if (NODE_MAJOR < 22) {
  console.error(`Node version ${process.version} is too old. Need >= 22.`);
  process.exit(1);
}

// Resolve mobile-mcp binary
function resolveMobileMcp(): string {
  const envOverride = process.env.VLLM_STUDIO_MOBILE_MCP_BIN;
  if (envOverride) return envOverride;

  // Try npx resolution
  const npxResult = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["-y", "@mobilenext/mobile-mcp@0.0.54"],
    { encoding: "utf-8", shell: process.platform === "win32" },
  );
  if (npxResult.error) {
    console.error("Failed to resolve mobile-mcp:", npxResult.error.message);
    process.exit(1);
  }
  return "npx";
}

async function main() {
  const command = resolveMobileMcp();
  const args = command === "npx" ? ["-y", "@mobilenext/mobile-mcp@0.0.54"] : [];

  const transport = new StdioClientTransport({
    command,
    args,
    env: { ...process.env } as Record<string, string>,
  });

  const client = new Client({ name: "probe-mobile-mcp", version: "0.1.0" });

  try {
    await client.connect(transport);

    const toolsResult = await client.listTools();

    let resourcesResult: { resources: Array<{ uri: string; name: string; mimeType?: string }> } = {
      resources: [],
    };
    try {
      resourcesResult = await client.listResources();
    } catch {
      // listResources may not be supported
    }

    const output = {
      nodeVersion: process.version,
      mobileMcpVersion: "0.0.54",
      tools: toolsResult.tools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      resources: resourcesResult.resources.map((r) => ({
        uri: r.uri,
        name: r.name,
        mimeType: r.mimeType,
      })),
    };

    console.log(JSON.stringify(output, null, 2));
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error(
      "Handshake or discovery failed:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}

main();
