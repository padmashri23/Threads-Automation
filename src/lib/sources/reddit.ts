import type { RawItem } from "../types";
import { fetchJson, fetchText, BROWSER_UA } from "../http";
import { canonicalUrl, domainOf, safeDate, sha, stripHtml, truncate, uniqBy } from "../utils";
import { parseFeed } from "./rss";

const SUBREDDITS = [
  "artificial",
  "MachineLearning",
  "LocalLLaMA",
  "singularity",
  "technology",
  "OpenAI",
  "ClaudeAI",
  "ArtificialInteligence",
  "programming",
  "robotics",
  "cybersecurity",
  "hardware",
  "ChatGPTCoding",
  "AI_Agents",
];

interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    permalink: string;
    score: number;
    num_comments: number;
    created_utc: number;
    selftext?: string;
    subreddit: string;
    is_self: boolean;
    stickied?: boolean;
  };
}

interface Listing {
  data: { children: RedditPost[] };
}

function toItem(p: RedditPost["data"], withEngagement: boolean): RawItem {
  const discussionUrl = `https://www.reddit.com${p.permalink}`;
  const url = p.is_self || !p.url || p.url.includes("reddit.com") || p.url.startsWith("/") ? discussionUrl : canonicalUrl(p.url);
  return {
    id: sha(url),
    source: `Reddit r/${p.subreddit}`,
    sourceKind: "social",
    title: p.title,
    url,
    discussionUrl,
    domain: domainOf(url),
    publishedAt: safeDate(p.created_utc * 1000),
    summary: p.selftext ? truncate(stripHtml(p.selftext), 300) : undefined,
    engagement: withEngagement ? { upvotes: p.score, comments: p.num_comments } : {},
  };
}

async function getOAuthToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT ?? "threads-ai-editor/1.0",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

/** Reddit: OAuth JSON (full engagement) -> anonymous JSON (often blocked) -> RSS (no scores). */
export async function collectReddit(sinceMs: number): Promise<{ items: RawItem[]; note?: string }> {
  const multi = SUBREDDITS.join("+");
  const token = await getOAuthToken().catch(() => null);
  const jsonUrl = token
    ? `https://oauth.reddit.com/r/${multi}/hot?limit=100&raw_json=1`
    : `https://old.reddit.com/r/${multi}/hot.json?limit=100&raw_json=1`;
  try {
    const listing = await fetchJson<Listing>(jsonUrl, {
      timeoutMs: 15000,
      ua: token ? (process.env.REDDIT_USER_AGENT ?? "threads-ai-editor/1.0") : BROWSER_UA,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const posts = listing.data.children
      .map((c) => c.data)
      .filter((p) => !p.stickied && p.created_utc * 1000 >= sinceMs);
    const items = uniqBy(posts.map((p) => toItem(p, true)), (i) => i.id);
    return { items, note: token ? "OAuth API" : "anonymous JSON" };
  } catch {
    // Fallback: one combined RSS request (titles + links, no vote counts). Reddit rate-limits
    // parallel anonymous requests, so a single multi-subreddit feed is used.
    const xml = await fetchText(`https://www.reddit.com/r/${multi}/.rss?limit=100`, { timeoutMs: 15000 });
    const items = parseFeed(xml).map((e) => {
      // Reddit RSS content holds the outbound link in an anchor; parseFeed stripped HTML from summary.
      const content = String((e.raw.content as { "#text"?: string } | undefined)?.["#text"] ?? "");
      const m = content.match(/href="(https?:\/\/(?!www\.reddit\.com)[^"]+)"/);
      const outbound = m ? canonicalUrl(m[1].replace(/&amp;/g, "&")) : e.link;
      const cat = e.raw.category as { "@_term"?: string } | undefined;
      const sub = cat?.["@_term"] ?? e.link.match(/\/r\/([^/]+)\//)?.[1] ?? "reddit";
      return toItem(
        {
          id: sha(e.link),
          title: e.title,
          url: outbound,
          permalink: e.link.replace(/^https?:\/\/www\.reddit\.com/, ""),
          score: 0,
          num_comments: 0,
          created_utc: Date.parse(e.published) / 1000,
          subreddit: sub,
          is_self: outbound === e.link,
        },
        false,
      );
    });
    const filtered = items.filter((i) => Date.parse(i.publishedAt) >= sinceMs);
    return {
      items: uniqBy(filtered, (i) => i.id),
      note: `RSS fallback (${SUBREDDITS.length} subreddits, vote counts unavailable; add REDDIT_CLIENT_ID/SECRET for engagement data)`,
    };
  }
}
