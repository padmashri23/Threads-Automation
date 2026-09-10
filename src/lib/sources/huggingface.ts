import type { RawItem } from "../types";
import { fetchJson } from "../http";
import { safeDate, sha, truncate } from "../utils";

interface DailyPaper {
  paper: { id: string; title: string; summary?: string; upvotes?: number; publishedAt?: string };
  publishedAt?: string;
  submittedOnDailyAt?: string;
  title?: string;
  numComments?: number;
}

interface HfModel {
  id: string;
  likes?: number;
  downloads?: number;
  createdAt?: string;
  lastModified?: string;
  pipeline_tag?: string;
  trendingScore?: number;
}

interface HfSpace {
  id: string;
  likes?: number;
  createdAt?: string;
  lastModified?: string;
  trendingScore?: number;
}

/** Hugging Face daily papers (community-upvoted research), trending models, and trending spaces. */
export async function collectHuggingFace(sinceMs: number): Promise<RawItem[]> {
  const items: RawItem[] = [];
  const [papers, models, spaces] = await Promise.allSettled([
    fetchJson<DailyPaper[]>("https://huggingface.co/api/daily_papers?limit=40", { timeoutMs: 15000 }),
    fetchJson<HfModel[]>("https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=30", { timeoutMs: 15000 }),
    fetchJson<HfSpace[]>("https://huggingface.co/api/spaces?sort=trendingScore&direction=-1&limit=15", { timeoutMs: 15000 }),
  ]);

  if (papers.status === "fulfilled") {
    for (const p of papers.value) {
      const when = safeDate(p.submittedOnDailyAt ?? p.publishedAt ?? p.paper.publishedAt);
      if (Date.parse(when) < sinceMs - 24 * 36e5) continue;
      const url = `https://arxiv.org/abs/${p.paper.id}`;
      items.push({
        id: sha(url),
        source: "Hugging Face Papers",
        sourceKind: "research",
        title: p.paper.title ?? p.title ?? "",
        url,
        discussionUrl: `https://huggingface.co/papers/${p.paper.id}`,
        domain: "arxiv.org",
        publishedAt: when,
        summary: truncate(p.paper.summary ?? "", 350),
        engagement: { upvotes: p.paper.upvotes ?? 0, comments: p.numComments ?? 0 },
      });
    }
  }

  if (models.status === "fulfilled") {
    for (const m of models.value) {
      const when = safeDate(m.createdAt ?? m.lastModified);
      // Trending models can be a bit older than the news window and still matter.
      if (Date.parse(when) < sinceMs - 5 * 864e5) continue;
      const url = `https://huggingface.co/${m.id}`;
      items.push({
        id: sha(url),
        source: "Hugging Face Models",
        sourceKind: "developer",
        title: `${m.id} (trending model${m.pipeline_tag ? ", " + m.pipeline_tag : ""})`,
        url,
        domain: "huggingface.co",
        publishedAt: when,
        summary: `Trending on Hugging Face: ${m.likes ?? 0} likes, ${m.downloads ?? 0} downloads.`,
        engagement: { likes: m.likes ?? 0, downloads: m.downloads ?? 0 },
      });
    }
  }

  if (spaces.status === "fulfilled") {
    for (const s of spaces.value) {
      const when = safeDate(s.createdAt ?? s.lastModified);
      if (Date.parse(when) < sinceMs - 5 * 864e5) continue;
      const url = `https://huggingface.co/spaces/${s.id}`;
      items.push({
        id: sha(url),
        source: "Hugging Face Spaces",
        sourceKind: "developer",
        title: `${s.id} (trending Space)`,
        url,
        domain: "huggingface.co",
        publishedAt: when,
        summary: `Trending demo on Hugging Face Spaces: ${s.likes ?? 0} likes.`,
        engagement: { likes: s.likes ?? 0 },
      });
    }
  }
  return items;
}
