import { NextRequest } from "next/server";
import { getMobileMcpClient, startMobileMcp } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_BUTTONS = new Set([
  "HOME",
  "BACK",
  "POWER",
  "VOLUME_UP",
  "VOLUME_DOWN",
  "ENTER",
  "DPAD_UP",
  "DPAD_DOWN",
  "DPAD_LEFT",
  "DPAD_RIGHT",
  "DPAD_CENTER",
]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { device?: string; button?: string };
    const deviceId = body.device?.trim();
    const button = body.button?.trim().toUpperCase();

    if (!deviceId) {
      return Response.json({ error: "device is required" }, { status: 400 });
    }
    if (!button) {
      return Response.json({ error: "button is required" }, { status: 400 });
    }
    if (!VALID_BUTTONS.has(button)) {
      return Response.json(
        { error: `Invalid button. Valid: ${[...VALID_BUTTONS].join(", ")}` },
        { status: 400 },
      );
    }

    await startMobileMcp();
    const client = getMobileMcpClient();
    const result = await client.pressButton(deviceId, button);

    if (result.isError) {
      const textContent = result.content.find((c) => c.type === "text");
      const errorMsg = textContent && textContent.type === "text" ? textContent.text : "Button press failed";
      return Response.json({ error: errorMsg }, { status: 500 });
    }

    return Response.json({ success: true, button });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Button press failed" },
      { status: 500 },
    );
  }
}
