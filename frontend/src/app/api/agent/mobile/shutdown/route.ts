import { stopMobileMcp } from "@/lib/mobile-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await stopMobileMcp();
  return Response.json({ ok: true });
}
