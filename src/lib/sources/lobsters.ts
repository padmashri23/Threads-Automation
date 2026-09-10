import type { RawItem } from "../types";
import { fetchJson } from "../http";
import { canonicalUrl, domainOf, safeDate, sha, uniqBy } from "../utils";

interface LobsterStory {
  short_id: string;
  created_at: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  tags: string[];
  short_id_url: string;
}

export async function collectLobsters(sinceMs: number): Promise<RawItem[]> {
  const [ai, hottest] = await Promise.allSettled([
    fetchJson<LobsterStory[]>("https://lobste.rs/t/ai.json", { timeoutMs: 12000 }),
    fetchJson<LobsterStory[]>("https://lobste.rs/hottest.json", { timeoutMs: 12000 }),
  ]);
  const stories: LobsterStory[] = [];
  if (ai.status === "fulfilled") stories.push(...ai.value);
  if (hottest.status === "fulfilled") stories.push(...hottest.value);
  const items = stories
    .filter((s) => Date.parse(s.created_at) >= sinceMs)
    .map((s) => {
      const url = s.url ? canonicalUrl(s.url) : s.short_id_url;
      return {
        id: sha(url),
        source: "Lobsters",
        sourceKind: "community" as const,
        title: s.title,
        url,
        discussionUrl: s.short_id_url,
        domain: domainOf(url),
        publishedAt: safeDate(s.created_at),
        summary: s.tags?.length ? `tags: ${s.tags.join(", ")}` : undefined,
        engagement: { points: s.score, comments: s.comment_count },
      };
    });
  return uniqBy(items, (i) => i.id);
}
