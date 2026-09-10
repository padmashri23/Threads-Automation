import { NextResponse } from "next/server";
import { getSettings, getStory, updateHistory, updateStory } from "@/lib/store";
import { generatePost, refinePost } from "@/lib/pipeline/generate";
import { verifyStory } from "@/lib/pipeline/verify";
import { hasApiKey, SETUP_MESSAGE } from "@/lib/ai/client";
import type { RefineAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: RefineAction[] = ["regenerate", "shorter", "conversational", "technical", "hook", "humanize", "custom"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!hasApiKey()) return NextResponse.json({ error: SETUP_MESSAGE }, { status: 400 });
  const body = (await req.json()) as { action: RefineAction; text?: string; instruction?: string };
  if (!ACTIONS.includes(body.action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  let story = getStory(id);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = getSettings();
  try {
    // Stories from the Discover page may not have been fact-checked yet; do it before writing.
    if (!story.factCheck) {
      const fc = await verifyStory(story);
      story = updateStory(id, { factCheck: fc, credibility: fc.status, credibilityLabel: fc.statusReason }) ?? story;
    }
    const post =
      body.action === "regenerate" || !body.text?.trim()
        ? await generatePost(story, settings)
        : await refinePost(story, body.text, body.action, settings, body.instruction);
    const updated = updateStory(id, { post });
    updateHistory(`h-${id}`, { post: post.text });
    return NextResponse.json({ story: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
