import type { RawItem } from "../types";
import { fetchJson, fetchText } from "../http";
import { cacheGet, cacheSet } from "../store";
import { safeDate, sha, truncate, uniqBy } from "../utils";
import { parseFeed } from "./rss";

/** AI/tech channels followed by handle; channel ids are resolved and cached. */
const CHANNELS: Array<{ handle: string; name: string; id?: string }> = [
  { handle: "@Fireship", name: "Fireship", id: "UC2Xd-TjJByJyK2w1zNwY0zQ" },
  { handle: "@aiexplained-official", name: "AI Explained", id: "UCNJ1Ymd5yFuUPtn21xtRbbw" },
  { handle: "@TwoMinutePapers", name: "Two Minute Papers", id: "UCbfYPyITQ-7l4upoX8nvctg" },
  { handle: "@YannicKilcher", name: "Yannic Kilcher", id: "UCHmD-oSpV0sNfAUnpYpj8KA" },
  { handle: "@AndrejKarpathy", name: "Andrej Karpathy", id: "UCYO_jab_esuFRV4b17AJtAw" },
  { handle: "@GoogleDeepMind", name: "Google DeepMind", id: "UCP7jMXSY2xbc3KCAE0MHQ-A" },
  { handle: "@OpenAI", name: "OpenAI", id: "UCXZCJLdBC09xxGZ6gcdrc6A" },
  { handle: "@anthropic-ai", name: "Anthropic", id: "UCrDwWp7EBBv4NwvScIpBDOA" },
  { handle: "@matthew_berman", name: "Matthew Berman", id: "UCawZsQWqfGSbCI5yjkdVkTA" },
  { handle: "@WesRoth", name: "Wes Roth", id: "UCqcbQf6yw5KzRoDDcZ_wBSw" },
  { handle: "@mreflow", name: "Matt Wolfe", id: "UChpleBmo18P08aKCIgti38g" },
  { handle: "@TheAIGRID", name: "TheAIGRID", id: "UCSPkiRjFYpz-8DY-aF_1wRg" },
  { handle: "@bycloudAI", name: "bycloud", id: "UCgfe2ooZD3VJPB6aJAnuQng" },
  { handle: "@ThePrimeTimeagen", name: "ThePrimeagen", id: "UC8ENHE5xdFSwx71u3fDH5Xw" },
  { handle: "@NVIDIA", name: "NVIDIA", id: "UCL-g3eGJi1omSDSz48AML-g" },
  { handle: "@MicrosoftResearch", name: "Microsoft Research", id: "UCCb9_Kn8F_Opb3UCGm-lILQ" },
  { handle: "@HuggingFace", name: "Hugging Face", id: "UCHlNU7kIZhRgSbhHvFoy72w" },
  { handle: "@technologyreview", name: "MIT Technology Review", id: "UCgy4Mf_tlZGqesYNqPNxjPw" },
  { handle: "@AICodeKing", name: "AICodeKing", id: "UC0m81bQuthaQZmFbXEY9QSw" },
];

async function resolveChannelId(handle: string): Promise<string | null> {
  const key = `yt_${handle}`;
  const cached = cacheGet<string>(key, 30 * 864e5);
  if (cached) return cached;
  try {
    const html = await fetchText(`https://www.youtube.com/${handle}/videos`, { timeoutMs: 20000 });
    const m = html.match(/channel_id=(UC[\w-]{20,})/) ?? html.match(/"externalId":"(UC[\w-]{20,})"/);
    if (m) {
      cacheSet(key, m[1]);
      return m[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parseViews(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase()] ?? 1;
  return Math.round(n * mult);
}

function parseRelative(s: string | undefined): string {
  if (!s) return new Date().toISOString();
  const m = s.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i);
  if (!m) return new Date().toISOString();
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const ms = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[unit] ?? 864e5;
  return new Date(Date.now() - n * ms).toISOString();
}

/** Walk ytInitialData for videoRenderer objects. */
function extractFromChannelHtml(html: string): Array<{ id: string; title: string; views?: number; published: string }> {
  const start = html.indexOf("var ytInitialData = ");
  if (start < 0) return [];
  const jsonStart = start + "var ytInitialData = ".length;
  const end = html.indexOf(";</script>", jsonStart);
  if (end < 0) return [];
  let data: unknown;
  try {
    data = JSON.parse(html.slice(jsonStart, end));
  } catch {
    return [];
  }
  const out: Array<{ id: string; title: string; views?: number; published: string }> = [];
  const seen = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const o = node as Record<string, unknown>;
    const vr = (o.videoRenderer ?? o.richItemRenderer) as Record<string, unknown> | undefined;
    if (vr && typeof vr.videoId === "string" && !seen.has(vr.videoId)) {
      seen.add(vr.videoId);
      const title = (vr.title as { runs?: Array<{ text: string }> })?.runs?.[0]?.text ?? "";
      const views = (vr.viewCountText as { simpleText?: string })?.simpleText;
      const pub = (vr.publishedTimeText as { simpleText?: string })?.simpleText;
      out.push({ id: vr.videoId, title, views: parseViews(views), published: parseRelative(pub) });
    }
    for (const k of Object.keys(o)) walk(o[k]);
  };
  walk(data);
  return out;
}

async function collectChannel(ch: { handle: string; name: string; id?: string }, sinceMs: number): Promise<RawItem[]> {
  const id = ch.id ?? (await resolveChannelId(ch.handle));
  const items: RawItem[] = [];
  // 1) RSS (includes media:statistics views)
  if (id) {
    try {
      const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { timeoutMs: 12000 });
      for (const e of parseFeed(xml)) {
        if (Date.parse(e.published) < sinceMs) continue;
        const group = e.raw["media:group"] as Record<string, unknown> | undefined;
        const community = group?.["media:community"] as Record<string, unknown> | undefined;
        const stats = community?.["media:statistics"] as Record<string, string> | undefined;
        const views = stats?.["@_views"] ? parseInt(stats["@_views"], 10) : undefined;
        const desc = (group?.["media:description"] as string | undefined) ?? "";
        items.push({
          id: sha(e.link),
          source: `YouTube · ${ch.name}`,
          sourceKind: "video",
          title: e.title,
          url: e.link,
          domain: "youtube.com",
          publishedAt: e.published,
          summary: truncate(String(desc), 300),
          author: ch.name,
          engagement: { views },
        });
      }
      if (items.length) return items;
    } catch {
      /* fall through */
    }
  }
  // 2) Channel page fallback
  try {
    const html = await fetchText(`https://www.youtube.com/${ch.handle}/videos`, { timeoutMs: 20000 });
    for (const v of extractFromChannelHtml(html).slice(0, 12)) {
      if (Date.parse(v.published) < sinceMs) continue;
      const url = `https://www.youtube.com/watch?v=${v.id}`;
      items.push({
        id: sha(url),
        source: `YouTube · ${ch.name}`,
        sourceKind: "video",
        title: v.title,
        url,
        domain: "youtube.com",
        publishedAt: v.published,
        author: ch.name,
        engagement: { views: v.views },
      });
    }
  } catch {
    /* ignore */
  }
  return items;
}

interface YtSearchResp {
  items: Array<{ id: { videoId: string }; snippet: { title: string; publishedAt: string; channelTitle: string; description: string } }>;
}
interface YtVideosResp {
  items: Array<{ id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }>;
}

/** Optional: YouTube Data API search when YOUTUBE_API_KEY is set. */
async function searchApi(sinceMs: number): Promise<RawItem[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const after = new Date(sinceMs).toISOString();
  const queries = ["AI model release", "AI agents", "open source AI", "AI coding tool", "Nvidia AI chip", "robotics AI"];
  const found: RawItem[] = [];
  for (const q of queries) {
    try {
      const s = await fetchJson<YtSearchResp>(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&publishedAfter=${after}&q=${encodeURIComponent(q)}&maxResults=10&key=${key}`,
        { timeoutMs: 12000 },
      );
      const ids = s.items.map((i) => i.id.videoId).join(",");
      const v = await fetchJson<YtVideosResp>(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${key}`, {
        timeoutMs: 12000,
      });
      const stats = new Map(v.items.map((i) => [i.id, i.statistics]));
      for (const it of s.items) {
        const url = `https://www.youtube.com/watch?v=${it.id.videoId}`;
        const st = stats.get(it.id.videoId);
        found.push({
          id: sha(url),
          source: `YouTube · ${it.snippet.channelTitle}`,
          sourceKind: "video",
          title: it.snippet.title,
          url,
          domain: "youtube.com",
          publishedAt: safeDate(it.snippet.publishedAt),
          summary: truncate(it.snippet.description, 300),
          author: it.snippet.channelTitle,
          engagement: { views: st?.viewCount ? parseInt(st.viewCount, 10) : undefined, likes: st?.likeCount ? parseInt(st.likeCount, 10) : undefined },
        });
      }
    } catch {
      /* ignore */
    }
  }
  return found;
}

export async function collectYouTube(sinceMs: number): Promise<{ items: RawItem[]; note: string }> {
  const results = await Promise.allSettled(CHANNELS.map((c) => collectChannel(c, sinceMs)));
  const items: RawItem[] = [];
  let ok = 0;
  for (const r of results) if (r.status === "fulfilled" && r.value.length) { ok++; items.push(...r.value); }
  const api = await searchApi(sinceMs);
  items.push(...api);
  return {
    items: uniqBy(items, (i) => i.id),
    note: `${ok}/${CHANNELS.length} channels returned recent videos${process.env.YOUTUBE_API_KEY ? ", plus Data API search" : " (set YOUTUBE_API_KEY for search-wide coverage)"}`,
  };
}
