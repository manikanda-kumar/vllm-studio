import { getMobileMcpClient } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MobileDevice = {
  id: string;
  name: string;
  platform: "ios" | "android";
  type: "real" | "emulator" | "simulator";
  state: "online" | "offline";
};

function isTransportNotReady(message: string): boolean {
  return (
    message.includes("ENOENT") ||
    message.includes("not found") ||
    message.includes("not ready") ||
    message.includes("startup timeout") ||
    message.includes("failed to initialize")
  );
}

export async function GET() {
  try {
    const client = getMobileMcpClient();
    await client.ensureReady();
    const result = await client.listDevices();

    const textContent = result.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return Response.json({ devices: [] });
    }

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
    if (isTransportNotReady(message)) {
      return Response.json(
        {
          error: message,
          code: "mobile_mcp_unavailable",
          health: getMobileMcpClient().getHealth(),
          devices: [],
        },
        { status: 503 },
      );
    }
    return Response.json({ error: message, devices: [] }, { status: 500 });
  }
}
