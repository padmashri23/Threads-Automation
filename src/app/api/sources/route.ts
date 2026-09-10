import { NextResponse } from "next/server";
import { collectAll } from "@/lib/sources";
import { getSettings } from "@/lib/store";
import { isRelevant } from "@/lib/pipeline/relevance";
import { mergeByUrl, preCluster } from "@/lib/pipeline/cluster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostics: run the collectors only (no AI) and report what each source returned. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sample = Number(url.searchParams.get("sample") ?? 3);
  const extract = url.searchParams.get("extract");
  if (extract) {
    const { extractArticle } = await import("@/lib/extract");
    const r = await extractArticle(extract);
    return NextResponse.json({ ok: r.ok, title: r.title, chars: r.text.length, preview: r.text.slice(0, 400), error: r.error });
  }
  const { items, reports } = await collectAll(getSettings().lookbackHours);
  const relevant = items.filter(isRelevant);
  const merged = mergeByUrl(relevant);
  const groups = preCluster(merged);
  const multi = groups.filter((g) => g.items.length > 1 || (g.items[0].mentions?.length ?? 0) > 0);
  return NextResponse.json({
    totals: { collected: items.length, relevant: relevant.length, merged: merged.length, groups: groups.length, crossSourceGroups: multi.length },
    reports,
    samples: reports
      .filter((r) => r.ok && r.count)
      .map((r) => ({ source: r.source, items: items.filter((i) => i.source === r.source || i.source.startsWith(r.source)).slice(0, sample).map((i) => ({ title: i.title, url: i.url, publishedAt: i.publishedAt, engagement: i.engagement })) })),
    crossSource: multi.slice(0, 15).map((g) => ({
      titles: g.items.map((i) => i.title),
      sources: g.items.flatMap((i) => [i.source, ...(i.mentions ?? []).map((m) => m.source)]),
    })),
  });
}
