import { NextRequest } from "next/server";
import { getMobileMcpClient } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTransportNotReady(message: string): boolean {
  return (
    message.includes("ENOENT") ||
    message.includes("not found") ||
    message.includes("not ready") ||
    message.includes("startup timeout") ||
    message.includes("failed to initialize")
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { device?: string; x?: number; y?: number };
    const deviceId = body.device?.trim();
    const x = body.x;
    const y = body.y;

    if (!deviceId) {
      return Response.json({ error: "device is required" }, { status: 400 });
    }
    if (typeof x !== "number" || typeof y !== "number") {
      return Response.json({ error: "x and y coordinates are required" }, { status: 400 });
    }

    const client = getMobileMcpClient();
    await client.ensureReady();
    const result = await client.tap(deviceId, x, y);

    if (result.isError) {
      const textContent = result.content.find((c) => c.type === "text");
      const errorMsg = textContent && textContent.type === "text" ? textContent.text : "Tap failed";
      return Response.json({ error: errorMsg }, { status: 500 });
    }

    return Response.json({ success: true, x, y });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tap failed";
    if (isTransportNotReady(message)) {
      return Response.json(
        {
          error: message,
          code: "mobile_mcp_unavailable",
          health: getMobileMcpClient().getHealth(),
        },
        { status: 503 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
