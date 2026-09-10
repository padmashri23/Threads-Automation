import { XMLParser } from "fast-xml-parser";
import type { RawItem, SourceKind } from "../types";
import { fetchText } from "../http";
import { canonicalUrl, domainOf, safeDate, sha, stripHtml, truncate } from "../utils";

export interface FeedDef {
  name: string;
  url: string;
  kind: SourceKind;
  /** If true, every item is treated as AI/tech relevant (AI-specific feeds). */
  aiFocused?: boolean;
  /** Optional item limit. */
  limit?: number;
}

// Feeds that answered during setup. Others are covered via Google News site: queries.
export const FEEDS: FeedDef[] = [
  // --- Official / primary sources ---
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", kind: "official", aiFocused: true },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", kind: "official", aiFocused: true },
  { name: "Google Research", url: "https://research.google/blog/rss/", kind: "official", aiFocused: true },
  { name: "NVIDIA Blog", url: "https://blogs.nvidia.com/feed/", kind: "official", aiFocused: true },
  { name: "NVIDIA Developer", url: "https://developer.nvidia.com/blog/feed", kind: "official", aiFocused: true },
  { name: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/feed/", kind: "official", aiFocused: true },
  { name: "Meta Newsroom", url: "https://about.fb.com/news/feed/", kind: "official" },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", kind: "official", aiFocused: true },
  { name: "GitHub Blog", url: "https://github.blog/feed/", kind: "official" },
  { name: "AWS Machine Learning Blog", url: "https://aws.amazon.com/blogs/machine-learning/feed/", kind: "official", aiFocused: true },
  { name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", kind: "official" },

  // --- Publications ---
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", kind: "publication", aiFocused: true },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", kind: "publication" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", kind: "publication" },
  { name: "Wired AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", kind: "publication", aiFocused: true },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", kind: "publication" },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", kind: "publication" },
  { name: "MIT News AI", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", kind: "publication", aiFocused: true },
  { name: "CNBC Technology", url: "https://www.cnbc.com/id/19854910/device/rss/rss.html", kind: "publication" },
  { name: "TechRadar", url: "https://www.techradar.com/rss", kind: "publication" },
  { name: "IEEE Spectrum AI", url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss", kind: "publication", aiFocused: true },
  { name: "The Decoder", url: "https://the-decoder.com/feed/", kind: "publication", aiFocused: true },
  { name: "The Register AI", url: "https://www.theregister.com/software/ai_ml/headlines.atom", kind: "publication", aiFocused: true },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml", kind: "publication" },
  { name: "MarkTechPost", url: "https://www.marktechpost.com/feed/", kind: "publication", aiFocused: true },
  { name: "AI News", url: "https://www.artificialintelligence-news.com/feed/", kind: "publication", aiFocused: true },
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", kind: "publication", aiFocused: true },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", kind: "publication", aiFocused: true },
  // ZDNET and Reuters publish no usable feed; both are covered through Google News site: queries.

  // --- Developer / product ---
  { name: "Product Hunt", url: "https://www.producthunt.com/feed", kind: "developer" },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "__cdata",
  trimValues: true,
});

type AnyObj = Record<string, unknown>;

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as AnyObj;
    if (o.__cdata != null) return text(o.__cdata);
    if (o["#text"] != null) return text(o["#text"]);
    if (o["@_href"] != null) return text(o["@_href"]);
  }
  return "";
}

function atomLink(v: unknown): string {
  if (!v) return "";
  const arr = Array.isArray(v) ? v : [v];
  const alt = arr.find((l) => (l as AnyObj)["@_rel"] === "alternate" || !(l as AnyObj)["@_rel"]);
  return text(alt ?? arr[0]);
}

export interface ParsedEntry {
  title: string;
  link: string;
  published: string;
  summary: string;
  author?: string;
  raw: AnyObj;
}

export function parseFeed(xml: string): ParsedEntry[] {
  const doc = parser.parse(xml) as AnyObj;
  const out: ParsedEntry[] = [];
  const rss = doc.rss as AnyObj | undefined;
  const channel = rss?.channel as AnyObj | undefined;
  if (channel) {
    const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
    for (const it of items as AnyObj[]) {
      out.push({
        title: stripHtml(text(it.title)),
        link: text(it.link) || text(it.guid),
        published: safeDate(text(it.pubDate) || text(it["dc:date"]) || text(it.published)),
        summary: stripHtml(text(it.description) || text(it["content:encoded"]) || text(it.summary)),
        author: stripHtml(text(it["dc:creator"]) || text(it.author)),
        raw: it,
      });
    }
    return out;
  }
  const feed = doc.feed as AnyObj | undefined;
  if (feed) {
    const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
    for (const e of entries as AnyObj[]) {
      const author = e.author as AnyObj | undefined;
      out.push({
        title: stripHtml(text(e.title)),
        link: atomLink(e.link),
        published: safeDate(text(e.published) || text(e.updated)),
        summary: stripHtml(text(e.summary) || text(e.content)),
        author: author ? stripHtml(text(author.name)) : undefined,
        raw: e,
      });
    }
  }
  return out;
}

export async function collectFeed(def: FeedDef, sinceMs: number): Promise<RawItem[]> {
  const xml = await fetchText(def.url, { timeoutMs: 15000 });
  const entries = parseFeed(xml);
  const items: RawItem[] = [];
  for (const e of entries.slice(0, def.limit ?? 60)) {
    if (!e.link || !e.title) continue;
    if (Date.parse(e.published) < sinceMs) continue;
    const url = canonicalUrl(e.link);
    items.push({
      id: sha(url),
      source: def.name,
      sourceKind: def.kind,
      title: e.title,
      url,
      domain: domainOf(url),
      publishedAt: e.published,
      summary: truncate(e.summary, 400),
      author: e.author || undefined,
      engagement: {},
    });
  }
  return items;
}
