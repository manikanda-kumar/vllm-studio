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

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device")?.trim();
  if (!deviceId) {
    return Response.json({ error: "device parameter required" }, { status: 400 });
  }

  try {
    const client = getMobileMcpClient();
    await client.ensureReady();
    const result = await client.takeScreenshot(deviceId);

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

    // Check for MCP-level error first
    if (result.isError) {
      const textContent = result.content.find((c) => c.type === "text");
      const errorMsg = textContent?.type === "text" ? textContent.text : "MCP tool error";
      return Response.json({ error: errorMsg }, { status: 500 });
    }

    const textContent = result.content.find((c) => c.type === "text");
    if (textContent && textContent.type === "text") {
      try {
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
      } catch {
        // Text wasn't JSON, treat as error message
        return Response.json({ error: textContent.text }, { status: 500 });
      }
    }

    return Response.json({ error: "No image in response" }, { status: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Screenshot failed";
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
