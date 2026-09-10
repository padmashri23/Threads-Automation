import type { RawItem } from "../types";
import { fetchText } from "../http";
import { safeDate, sha, stripHtml, truncate, uniqBy } from "../utils";
import { parseFeed } from "./rss";

/**
 * Google News RSS is the "wide net": it surfaces coverage from outlets we don't poll directly
 * (Reuters, Bloomberg, WSJ, The Information, Semafor, Axios, regional press, ...) and gives an
 * independent-coverage signal. Publisher name comes from the <source> element.
 */
const QUERIES: Array<{ label: string; q: string }> = [
  { label: "AI", q: "artificial intelligence when:1d" },
  { label: "AI models", q: "(OpenAI OR Anthropic OR DeepMind OR Gemini OR Claude OR GPT OR Mistral OR xAI OR Grok OR Llama OR Qwen OR DeepSeek) when:1d" },
  { label: "AI agents & coding", q: "(\"AI agent\" OR \"AI agents\" OR \"AI coding\" OR Copilot OR Cursor) when:1d" },
  { label: "AI chips", q: "(Nvidia OR AMD OR TSMC OR \"AI chip\" OR GPU) when:1d" },
  { label: "Robotics", q: "(humanoid robot OR robotics AI) when:1d" },
  { label: "AI policy & safety", q: "(\"AI regulation\" OR \"AI safety\" OR \"AI Act\") when:1d" },
  { label: "AI security", q: "(\"AI security\" OR cyberattack AI OR \"prompt injection\") when:1d" },
  { label: "AI startups", q: "(AI startup raises OR AI acquisition OR AI funding) when:1d" },
  { label: "Big Tech", q: "(Apple OR Google OR Microsoft OR Meta OR Amazon) AI when:1d" },
  { label: "Reuters Tech", q: "site:reuters.com (AI OR chips OR technology) when:1d" },
  { label: "Bloomberg Tech", q: "site:bloomberg.com (AI OR chips) when:1d" },
  { label: "The Information", q: "site:theinformation.com when:1d" },
  { label: "VentureBeat", q: "site:venturebeat.com when:1d" },
  { label: "ZDNET", q: "site:zdnet.com AI when:1d" },
  { label: "Mistral", q: "site:mistral.ai OR \"Mistral AI\" when:2d" },
  { label: "xAI", q: "site:x.ai OR (xAI Grok) when:2d" },
  { label: "Meta AI", q: "site:ai.meta.com OR \"Meta AI\" when:2d" },
];

export async function collectGoogleNews(sinceMs: number): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    QUERIES.map(async (def) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(def.q)}&hl=en-US&gl=US&ceid=US:en`;
      const xml = await fetchText(url, { timeoutMs: 15000 });
      return parseFeed(xml).map((e) => {
        const src = e.raw.source as { "#text"?: string; "@_url"?: string } | string | undefined;
        const publisher = typeof src === "string" ? src : (src?.["#text"] ?? "");
        const publisherUrl = typeof src === "object" ? (src?.["@_url"] ?? "") : "";
        // Titles are "Headline - Publisher"; strip the trailing publisher.
        const title = publisher && e.title.endsWith(` - ${publisher}`) ? e.title.slice(0, -(publisher.length + 3)) : e.title;
        let domain = "";
        try {
          domain = new URL(publisherUrl).hostname.replace(/^www\./, "");
        } catch {
          domain = publisher.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".news";
        }
        return {
          id: sha(e.link),
          source: publisher ? `${publisher} (via Google News)` : "Google News",
          sourceKind: "aggregator" as const,
          title: stripHtml(title),
          url: e.link,
          domain,
          publishedAt: safeDate(e.published),
          summary: truncate(stripHtml(e.summary), 200),
          engagement: {},
        } as RawItem;
      });
    }),
  );
  const items: RawItem[] = [];
  for (const r of results) if (r.status === "fulfilled") items.push(...r.value);
  return uniqBy(
    items.filter((i) => i.title && Date.parse(i.publishedAt) >= sinceMs),
    (i) => i.id,
  );
}
