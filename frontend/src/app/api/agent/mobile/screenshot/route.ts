import { NextRequest } from "next/server";
import { getMobileMcpClient, startMobileMcp } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device")?.trim();
  if (!deviceId) {
    return Response.json({ error: "device parameter required" }, { status: 400 });
  }

  try {
    await startMobileMcp();
    const client = getMobileMcpClient();
    const result = await client.takeScreenshot(deviceId);

    // Find image content in MCP result
    const imageContent = result.content.find((c) => c.type === "image");
    if (imageContent && imageContent.type === "image") {
      const buffer = Buffer.from(imageContent.data, "base64");
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": imageContent.mimeType || "image/png",
          "Cache-Control": "no-store",
        },
      });
    }

    // Fallback: check if text contains base64 image
    const textContent = result.content.find((c) => c.type === "text");
    if (textContent && textContent.type === "text") {
      const parsed = JSON.parse(textContent.text) as { image?: string; base64?: string };
      const base64 = parsed.image ?? parsed.base64;
      if (base64) {
        const buffer = Buffer.from(base64, "base64");
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
          },
        });
      }
    }

    return Response.json({ error: "No image in response" }, { status: 500 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Screenshot failed" },
      { status: 500 },
    );
  }
}
