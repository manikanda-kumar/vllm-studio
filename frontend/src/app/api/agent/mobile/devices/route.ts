import { getMobileMcpClient, startMobileMcp } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MobileDevice = {
  id: string;
  name: string;
  platform: "ios" | "android";
  type: "real" | "emulator" | "simulator";
  state: "online" | "offline";
};

export async function GET() {
  try {
    // Ensure mobile-mcp is running
    await startMobileMcp();
    const client = getMobileMcpClient();

    const result = await client.listDevices();

    // Parse MCP tool result - content is array of text/image items
    const textContent = result.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return Response.json({ devices: [] });
    }

    // Parse the JSON from the text response
    const parsed = JSON.parse(textContent.text) as {
      devices?: Array<{
        id?: string;
        udid?: string;
        name?: string;
        platform?: string;
        type?: string;
        state?: string;
        status?: string;
      }>;
    };

    // Normalize device format
    const devices: MobileDevice[] = (parsed.devices ?? []).map((d) => ({
      id: d.id ?? d.udid ?? "",
      name: d.name ?? "Unknown",
      platform: (d.platform?.toLowerCase() === "ios" ? "ios" : "android") as "ios" | "android",
      type: (d.type?.toLowerCase() ?? "emulator") as "real" | "emulator" | "simulator",
      state: (d.state?.toLowerCase() === "online" || d.status?.toLowerCase() === "online"
        ? "online"
        : "offline") as "online" | "offline",
    }));

    return Response.json({ devices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list devices";
    const isMissing =
      message.includes("ENOENT") ||
      message.includes("not found") ||
      message.includes("not ready") ||
      message.includes("startup timeout");
    if (isMissing) {
      return Response.json({ devices: [], unavailable: true });
    }
    return Response.json({ error: message, devices: [] }, { status: 500 });
  }
}
