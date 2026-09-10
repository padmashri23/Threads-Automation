import type { RawItem, SourceReport } from "../types";
import { FEEDS, collectFeed } from "./rss";
import { collectHackerNews } from "./hackernews";
import { collectReddit } from "./reddit";
import { collectGitHub } from "./github";
import { collectArxiv } from "./arxiv";
import { collectHuggingFace } from "./huggingface";
import { collectYouTube } from "./youtube";
import { collectLobsters } from "./lobsters";
import { collectGoogleNews } from "./googlenews";
import { collectX } from "./x";
import { collectLabPages } from "./scrape";
import { pLimitAll } from "../utils";

export interface CollectResult {
  items: RawItem[];
  reports: SourceReport[];
}

type Task = { name: string; run: () => Promise<{ items: RawItem[]; note?: string }> };

export async function collectAll(
  lookbackHours: number,
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<CollectResult> {
  const sinceMs = Date.now() - lookbackHours * 36e5;
  const tasks: Task[] = [
    { name: "Hacker News", run: async () => ({ items: await collectHackerNews(sinceMs) }) },
    { name: "Reddit", run: () => collectReddit(sinceMs) },
    { name: "GitHub", run: async () => ({ items: await collectGitHub() }) },
    { name: "arXiv", run: async () => ({ items: await collectArxiv(sinceMs) }) },
    { name: "Hugging Face", run: async () => ({ items: await collectHuggingFace(sinceMs) }) },
    { name: "YouTube", run: () => collectYouTube(sinceMs) },
    { name: "Lobsters", run: async () => ({ items: await collectLobsters(sinceMs) }) },
    { name: "Google News (wide net)", run: async () => ({ items: await collectGoogleNews(sinceMs) }) },
    { name: "X / Twitter", run: () => collectX(sinceMs) },
    { name: "Lab news pages", run: () => collectLabPages(sinceMs) },
    ...FEEDS.map((f) => ({ name: f.name, run: async () => ({ items: await collectFeed(f, sinceMs) }) })),
  ];

  const items: RawItem[] = [];
  const reports: SourceReport[] = [];
  let done = 0;
  const results = await pLimitAll(
    tasks.map((t) => async () => {
      const t0 = Date.now();
      try {
        const r = await t.run();
        reports.push({ source: t.name, count: r.items.length, ok: true, note: r.note, ms: Date.now() - t0 });
        items.push(...r.items);
      } catch (e) {
        reports.push({ source: t.name, count: 0, ok: false, note: (e as Error).message, ms: Date.now() - t0 });
      } finally {
        done++;
        onProgress?.(done, tasks.length, t.name);
      }
    }),
    8,
  );
  void results;
  reports.sort((a, b) => b.count - a.count);
  return { items, reports };
}

export const SOURCE_NOTES = {
  instagram: "Instagram has no public API for trend discovery; it is not polled.",
  papersWithCode: "Papers With Code was shut down in 2025; Hugging Face Papers is used instead.",
};
