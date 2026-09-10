import { NextResponse } from "next/server";
import { getStory, updateHistory, updateStory } from "@/lib/store";
import type { GeneratedPost } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const story = getStory(id);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ story });
}

/** Save a manual edit of the post text. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { text?: string };
  const story = getStory(id);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (typeof body.text !== "string") return NextResponse.json({ error: "text required" }, { status: 400 });
  const parts = body.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const post: GeneratedPost = {
    ...(story.post ?? { hook: parts[0] ?? "", angle: "", factualBasis: [], version: 0 }),
    text: body.text,
    parts,
    generatedAt: new Date().toISOString(),
    version: (story.post?.version ?? 0) + 1,
    lastAction: "manual edit",
  };
  const updated = updateStory(id, { post });
  updateHistory(`h-${id}`, { post: body.text });
  return NextResponse.json({ story: updated });
}
