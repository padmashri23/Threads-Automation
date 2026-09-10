import type { RawItem } from "../types";
import { fetchJson } from "../http";
import { canonicalUrl, domainOf, safeDate, sha, truncate, uniqBy } from "../utils";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics?: { like_count: number; retweet_count: number; reply_count: number; quote_count: number };
  entities?: { urls?: Array<{ expanded_url?: string; unwound_url?: string }> };
}
interface SearchResp {
  data?: Tweet[];
  includes?: { users?: Array<{ id: string; username: string; name: string }> };
}

/**
 * X / Twitter requires a paid API bearer token. When X_BEARER_TOKEN is set we pull high-engagement
 * recent posts about AI; otherwise this source is skipped and reported as such.
 */
export async function collectX(sinceMs: number): Promise<{ items: RawItem[]; note: string }> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { items: [], note: "skipped: set X_BEARER_TOKEN to enable X/Twitter discovery" };
  const queries = [
    "(AI OR LLM OR \"open source\" OR agents) (launch OR released OR announcing OR \"new model\") -is:retweet -is:reply lang:en",
    "(OpenAI OR Anthropic OR DeepMind OR Nvidia OR Mistral OR xAI OR \"Hugging Face\") -is:retweet -is:reply lang:en",
  ];
  const items: RawItem[] = [];
  for (const q of queries) {
    try {
      const url =
        `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=100` +
        `&tweet.fields=public_metrics,created_at,entities,author_id&expansions=author_id&user.fields=username,name` +
        `&start_time=${new Date(sinceMs).toISOString()}`;
      const r = await fetchJson<SearchResp>(url, { timeoutMs: 15000, headers: { Authorization: `Bearer ${token}` } });
      const users = new Map((r.includes?.users ?? []).map((u) => [u.id, u]));
      for (const t of r.data ?? []) {
        const m = t.public_metrics;
        const score = (m?.like_count ?? 0) + 3 * (m?.retweet_count ?? 0) + 2 * (m?.quote_count ?? 0);
        if (score < 200) continue; // only posts with real traction
        const u = users.get(t.author_id);
        const outbound = t.entities?.urls?.map((x) => x.unwound_url ?? x.expanded_url).find((x) => x && !x.includes("x.com") && !x.includes("twitter.com"));
        const tweetUrl = `https://x.com/${u?.username ?? "i"}/status/${t.id}`;
        const link = outbound ? canonicalUrl(outbound) : tweetUrl;
        items.push({
          id: sha(link),
          source: `X · @${u?.username ?? "unknown"}`,
          sourceKind: "social",
          title: truncate(t.text.replace(/\s+/g, " "), 160),
          url: link,
          discussionUrl: tweetUrl,
          domain: domainOf(link),
          publishedAt: safeDate(t.created_at),
          summary: truncate(t.text, 400),
          author: u?.name,
          engagement: { likes: m?.like_count, reposts: m?.retweet_count, comments: m?.reply_count },
        });
      }
    } catch (e) {
      return { items, note: `X API error: ${(e as Error).message}` };
    }
  }
  return { items: uniqBy(items, (i) => i.id), note: "X API (recent search)" };
}
