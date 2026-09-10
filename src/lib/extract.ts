import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { fetchText } from "./http";
import { stripHtml, truncate } from "./utils";

export interface Extracted {
  url: string;
  title: string;
  text: string;
  byline?: string;
  ok: boolean;
  error?: string;
}

/** Fetch a page and extract readable article text (best effort). */
export async function extractArticle(url: string, maxChars = 7000): Promise<Extracted> {
  try {
    if (url.includes("news.google.com/rss/")) {
      return { url, title: "", text: "", ok: false, error: "Google News redirect link cannot be fetched directly" };
    }
    const html = await fetchText(url, { timeoutMs: 15000 });
    const vc = new VirtualConsole();
    vc.on("error", () => {});
    const dom = new JSDOM(html, { url, virtualConsole: vc });
    const article = new Readability(dom.window.document).parse();
    let text = article?.textContent ? article.textContent.replace(/\s+/g, " ").trim() : "";
    if (text.length < 300) {
      // Fallback: meta description + stripped body
      const desc = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ?? "";
      text = `${stripHtml(desc)} ${stripHtml(html).slice(0, maxChars)}`.trim();
    }
    return {
      url,
      title: article?.title ?? stripHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ""),
      text: truncate(text, maxChars),
      byline: article?.byline ?? undefined,
      ok: text.length > 200,
    };
  } catch (e) {
    return { url, title: "", text: "", ok: false, error: (e as Error).message };
  }
}
