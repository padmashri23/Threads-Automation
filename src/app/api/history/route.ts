import { NextResponse } from "next/server";
import { getHistory, getStory, updateHistory, upsertHistory } from "@/lib/store";
import type { HistoryStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ history: getHistory() });
}

/** Update status of an entry, or add a story from Discover to history. */
export async function PATCH(req: Request) {
  const body = (await req.json()) as { id?: string; storyId?: string; status: HistoryStatus };
  if (!["suggested", "published", "skipped"].includes(body.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
  if (body.id) {
    const e = updateHistory(body.id, { status: body.status });
    if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ entry: e });
  }
  if (body.storyId) {
    const s = getStory(body.storyId);
    if (!s) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    const entry = {
      id: `h-${s.id}`,
      date: new Date().toISOString(),
      runId: s.runId,
      storyId: s.id,
      headline: s.headline,
      summary: s.whatHappened,
      category: s.category,
      topicKey: s.assessment.topicKey,
      trendScore: s.trendScore,
      qualityScore: s.qualityScore,
      post: s.post?.text ?? "",
      status: body.status,
      sources: s.sources.slice(0, 8),
    };
    upsertHistory(entry);
    return NextResponse.json({ entry });
  }
  return NextResponse.json({ error: "id or storyId required" }, { status: 400 });
}
