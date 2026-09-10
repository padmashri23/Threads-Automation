import fs from "fs";
import { visualFilePath } from "@/lib/visuals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serve a rendered slide PNG. Add ?download=1 to get it as an attachment. */
export async function GET(req: Request, ctx: { params: Promise<{ storyId: string; file: string }> }) {
  const { storyId, file } = await ctx.params;
  const p = visualFilePath(storyId, file);
  if (!p) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const buf = fs.readFileSync(p);
  const headers: Record<string, string> = { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" };
  if (url.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename="${storyId}-${file}"`;
  return new Response(new Uint8Array(buf), { headers });
}
