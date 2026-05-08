import { NextRequest } from "next/server";
import { getMobileMcpClient, startMobileMcp } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    await startMobileMcp();
    const client = getMobileMcpClient();
    const result = await client.tap(deviceId, x, y);

    if (result.isError) {
      const textContent = result.content.find((c) => c.type === "text");
      const errorMsg = textContent && textContent.type === "text" ? textContent.text : "Tap failed";
      return Response.json({ error: errorMsg }, { status: 500 });
    }

    return Response.json({ success: true, x, y });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Tap failed" },
      { status: 500 },
    );
  }
}
