import type { RawItem } from "../types";
import { fetchText } from "../http";
import { sha, stripHtml, truncate } from "../utils";

/**
 * Best-effort scrapers for labs that publish no feed. We only take link + title from the listing
 * page; the real date is unknown, so these are marked with the run time and used mainly as an
 * "official source exists" signal that clustering can attach to a trending story.
 */
interface PageDef {
  name: string;
  url: string;
  linkPattern: RegExp; // captures relative path
  base: string;
}

const PAGES: PageDef[] = [
  { name: "Anthropic", url: "https://www.anthropic.com/news", linkPattern: /href="(\/news\/[^"#?]+)"/g, base: "https://www.anthropic.com" },
  { name: "Anthropic Research", url: "https://www.anthropic.com/research", linkPattern: /href="(\/research\/[^"#?]+)"/g, base: "https://www.anthropic.com" },
  { name: "Meta AI", url: "https://ai.meta.com/blog/", linkPattern: /href="(\/blog\/[^"#?]+)"/g, base: "https://ai.meta.com" },
  { name: "Mistral", url: "https://mistral.ai/news", linkPattern: /href="(\/news\/[^"#?]+)"/g, base: "https://mistral.ai" },
  { name: "xAI", url: "https://x.ai/news", linkPattern: /href="(\/news\/[^"#?]+)"/g, base: "https://x.ai" },
  { name: "Apple Machine Learning Research", url: "https://machinelearning.apple.com/research", linkPattern: /href="(\/research\/[^"#?]+)"/g, base: "https://machinelearning.apple.com" },
];

function titleFromSlug(slug: string): string {
  const last = slug.split("/").filter(Boolean).pop() ?? slug;
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchTitle(url: string): Promise<{ title: string; description: string; published?: string } | null> {
  try {
    const html = await fetchText(url, { timeoutMs: 12000 });
    const og = html.match(/property="og:title"\s+content="([^"]+)"/i) ?? html.match(/content="([^"]+)"\s+property="og:title"/i);
    const t = og?.[1] ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
    const d =
      html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ??
      html.match(/name="description"\s+content="([^"]+)"/i)?.[1] ??
      "";
    const p =
      html.match(/property="article:published_time"\s+content="([^"]+)"/i)?.[1] ??
      html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1];
    return { title: stripHtml(t), description: stripHtml(d), published: p };
  } catch {
    return null;
  }
}

export async function collectLabPages(sinceMs: number): Promise<{ items: RawItem[]; note: string }> {
  const items: RawItem[] = [];
  const okPages: string[] = [];
  await Promise.allSettled(
    PAGES.map(async (p) => {
      const html = await fetchText(p.url, { timeoutMs: 15000 });
      const links: string[] = [];
      for (const m of html.matchAll(p.linkPattern)) {
        const path = m[1];
        if (!links.includes(path)) links.push(path);
      }
      if (!links.length) return;
      okPages.push(p.name);
      // Only inspect the first few (newest) entries and fetch their pages for real titles/dates.
      const top = links.slice(0, 6);
      await Promise.allSettled(
        top.map(async (path) => {
          const url = p.base + path;
          const meta = await fetchTitle(url);
          const published = meta?.published ? Date.parse(meta.published) : NaN;
          // If the page tells us a date and it's outside the window, skip it.
          if (!Number.isNaN(published) && published < sinceMs) return;
          items.push({
            id: sha(url),
            source: p.name,
            sourceKind: "official",
            title: meta?.title || titleFromSlug(path),
            url,
            domain: new URL(p.base).hostname.replace(/^www\./, ""),
            publishedAt: !Number.isNaN(published) ? new Date(published).toISOString() : new Date(sinceMs + 1).toISOString(),
            summary: truncate(meta?.description ?? "", 300) || (Number.isNaN(published) ? "Date not stated on page; treated as recent listing." : undefined),
            engagement: {},
          });
        }),
      );
    }),
  );
  return { items, note: okPages.length ? `pages read: ${okPages.join(", ")}` : "no lab pages readable" };
}
