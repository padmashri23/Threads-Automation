import { NextResponse } from "next/server";
import { getSettings, getStory, updateStory } from "@/lib/store";
import { generateVisuals, rerenderVisuals } from "@/lib/visuals";
import { verifyStory } from "@/lib/pipeline/verify";
import { hasApiKey, SETUP_MESSAGE } from "@/lib/ai/client";
import type { Slide } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate (or regenerate) visuals with the model. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!hasApiKey()) return NextResponse.json({ error: SETUP_MESSAGE }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { mode?: "auto" | "single" | "carousel"; instruction?: string };
  let story = getStory(id);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    if (!story.factCheck) {
      const fc = await verifyStory(story);
      story = updateStory(id, { factCheck: fc, credibility: fc.status, credibilityLabel: fc.statusReason }) ?? story;
    }
    const visuals = await generateVisuals(story, getSettings(), body.mode ?? "auto", body.instruction);
    const updated = updateStory(id, { visuals });
    return NextResponse.json({ story: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Re-render after the user edits slide text. No model call. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { slides: Slide[] };
  const story = getStory(id);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!Array.isArray(body.slides)) return NextResponse.json({ error: "slides required" }, { status: 400 });
  try {
    const visuals = await rerenderVisuals(story, body.slides.slice(0, 6), getSettings());
    const updated = updateStory(id, { visuals });
    return NextResponse.json({ story: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
