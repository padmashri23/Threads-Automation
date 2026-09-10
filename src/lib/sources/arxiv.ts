import type { RawItem } from "../types";
import { fetchText } from "../http";
import { safeDate, sha, truncate } from "../utils";
import { parseFeed } from "./rss";

/** Latest arXiv submissions in core AI categories. Alone these rarely trend; they matter when
 *  cross-referenced with Hugging Face papers, HN, or Reddit discussion. */
export async function collectArxiv(sinceMs: number): Promise<RawItem[]> {
  const q = "cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.RO OR cat:cs.CR";
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=80`;
  const xml = await fetchText(url, { timeoutMs: 20000 });
  const entries = parseFeed(xml);
  return entries
    .filter((e) => e.link && Date.parse(e.published) >= sinceMs - 24 * 36e5)
    .map((e) => {
      const link = e.link.replace(/v\d+$/, "");
      return {
        id: sha(link),
        source: "arXiv",
        sourceKind: "research" as const,
        title: e.title.replace(/\s+/g, " "),
        url: link,
        domain: "arxiv.org",
        publishedAt: safeDate(e.published),
        summary: truncate(e.summary, 350),
        author: e.author,
        engagement: {},
      };
    });
}
