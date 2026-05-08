import { NextRequest } from "next/server";
import { getMobileMcpClient } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRAME_INTERVAL_MS = 200; // ~5fps

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device")?.trim();
  if (!deviceId) {
    return Response.json({ error: "device parameter required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let running = true;

      const captureFrame = async () => {
        if (!running) return;

        try {
          const client = getMobileMcpClient();
          await client.ensureReady();
          const result = await client.takeScreenshot(deviceId);

          if (result.isError) {
            const textContent = result.content.find((c) => c.type === "text");
            const errorMsg = textContent?.type === "text" ? textContent.text : "MCP tool error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`),
            );
            return;
          }

          // Try to extract image from response
          const imageContent = result.content.find((c) => c.type === "image");
          if (imageContent && imageContent.type === "image") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "frame",
                  data: imageContent.data,
                  mimeType: imageContent.mimeType || "image/png",
                })}\n\n`,
              ),
            );
            return;
          }

          // Try text content with embedded base64
          const textContent = result.content.find((c) => c.type === "text");
          if (textContent && textContent.type === "text") {
            try {
              const parsed = JSON.parse(textContent.text) as { image?: string; base64?: string };
              const base64 = parsed.image ?? parsed.base64;
              if (base64) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "frame",
                      data: base64,
                      mimeType: "image/png",
                    })}\n\n`,
                  ),
                );
                return;
              }
            } catch {
              // Not JSON, ignore
            }
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: "No image in response" })}\n\n`),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Frame capture failed";
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`),
            );
          } catch {
            // Controller closed
            running = false;
          }
        }
      };

      // Initial frame
      await captureFrame();

      // Frame loop
      const interval = setInterval(() => {
        if (running) {
          void captureFrame();
        }
      }, FRAME_INTERVAL_MS);

      // Keepalive ping
      const ping = setInterval(() => {
        if (running) {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            running = false;
          }
        }
      }, 25_000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        running = false;
        clearInterval(interval);
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
