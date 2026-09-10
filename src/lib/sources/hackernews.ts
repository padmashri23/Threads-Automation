import type { RawItem } from "../types";
import { fetchJson } from "../http";
import { canonicalUrl, domainOf, safeDate, sha, stripHtml, truncate, uniqBy } from "../utils";

interface Hit {
  objectID: string;
  title: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at: string;
  author?: string;
  story_text?: string;
}

interface AlgoliaResp {
  hits: Hit[];
}

function toItem(h: Hit): RawItem {
  const discussionUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
  const url = h.url ? canonicalUrl(h.url) : discussionUrl;
  return {
    id: sha(url),
    source: "Hacker News",
    sourceKind: "community",
    title: h.title,
    url,
    discussionUrl,
    domain: domainOf(url),
    publishedAt: safeDate(h.created_at),
    summary: h.story_text ? truncate(stripHtml(h.story_text), 300) : undefined,
    author: h.author,
    engagement: { points: h.points ?? 0, comments: h.num_comments ?? 0 },
  };
}

export async function collectHackerNews(sinceMs: number): Promise<RawItem[]> {
  const sinceSec = Math.floor(sinceMs / 1000);
  const base = "https://hn.algolia.com/api/v1";
  const urls = [
    `${base}/search?tags=front_page&hitsPerPage=60`,
    `${base}/search_by_date?tags=story&numericFilters=${encodeURIComponent(`created_at_i>${sinceSec},points>15`)}&hitsPerPage=100`,
    `${base}/search?tags=story&numericFilters=${encodeURIComponent(`created_at_i>${sinceSec}`)}&hitsPerPage=100`,
    `${base}/search?query=${encodeURIComponent("AI OR LLM OR GPT OR Claude OR Gemini OR agents OR open source model")}&tags=story&numericFilters=${encodeURIComponent(`created_at_i>${sinceSec}`)}&hitsPerPage=100`,
  ];
  const results = await Promise.allSettled(urls.map((u) => fetchJson<AlgoliaResp>(u, { timeoutMs: 15000 })));
  const hits: Hit[] = [];
  for (const r of results) if (r.status === "fulfilled") hits.push(...r.value.hits);
  const items = hits
    .filter((h) => h.title && Date.parse(h.created_at) >= sinceMs - 6 * 36e5)
    .map(toItem);
  return uniqBy(items, (i) => i.id);
}
