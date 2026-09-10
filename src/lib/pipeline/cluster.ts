import { z } from "zod";
import type { AiAssessment, Category, RawItem } from "../types";
import { CATEGORIES } from "../types";
import { structured } from "../ai/client";
import { hoursSince, truncate } from "../utils";

// ---------- Stage 1: deterministic merging ----------

const STOP = new Set(
  "the a an and or of to in on for with by from at as is are was were be been this that it its into over after before new how why what when who says said announces announced launches launched release released releases unveils introduces update updates vs via your you we our their has have had can will just now today about more most than out up down off".split(
    " ",
  ),
);

export function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9.+#\s-]/g, " ")
      .split(/\s+/)
      .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/** Merge exact-URL duplicates (same article shared on HN + Reddit + feed) into one item with mentions. */
export function mergeByUrl(items: RawItem[]): RawItem[] {
  const byUrl = new Map<string, RawItem>();
  const kindRank: Record<string, number> = { official: 0, publication: 1, research: 2, developer: 3, aggregator: 4, community: 5, social: 6, video: 7 };
  for (const it of items) {
    const key = it.url.toLowerCase();
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...it, mentions: [...(it.mentions ?? [])] });
      continue;
    }
    // Keep the most "primary" record as the head; the other becomes a mention.
    const headIsBetter = (kindRank[existing.sourceKind] ?? 9) <= (kindRank[it.sourceKind] ?? 9);
    const head = headIsBetter ? existing : { ...it, mentions: [...(it.mentions ?? [])] };
    const tail = headIsBetter ? it : existing;
    head.mentions = [
      ...(head.mentions ?? []),
      { source: tail.source, url: tail.discussionUrl ?? tail.url, engagement: tail.engagement, publishedAt: tail.publishedAt },
      ...(tail.mentions ?? []),
    ];
    if (!head.summary && tail.summary) head.summary = tail.summary;
    if (Date.parse(tail.publishedAt) < Date.parse(head.publishedAt)) head.publishedAt = tail.publishedAt;
    byUrl.set(key, head);
  }
  return [...byUrl.values()];
}

export interface PreCluster {
  id: number;
  items: RawItem[];
}

/** Greedy title-similarity grouping. Conservative: only merges clearly-identical headlines. */
export function preCluster(items: RawItem[]): PreCluster[] {
  const toks = items.map((i) => tokens(i.title));
  const parent = items.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = toks[i];
      const b = toks[j];
      if (a.size < 3 || b.size < 3) continue;
      const jac = jaccard(a, b);
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      const containment = inter / Math.min(a.size, b.size);
      if (jac >= 0.55 || (containment >= 0.8 && inter >= 3)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, RawItem[]>();
  items.forEach((it, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(it);
  });
  return [...groups.values()].map((g, i) => ({ id: i, items: g }));
}

// ---------- Stage 2: model clustering + assessment ----------

const CategoryEnum = z.enum(CATEGORIES as [Category, ...Category[]]);

const ClusterSchema = z.object({
  clusters: z
    .array(
      z.object({
        headline: z.string().describe("Neutral, specific headline for the underlying event (max 110 chars). No hype."),
        memberIds: z.array(z.number().int()).describe("Ids of every input entry that is about this same underlying event."),
        category: CategoryEnum,
        tags: z.array(z.string()).max(6),
        whatHappened: z.string().describe("1-2 sentences stating only what the inputs actually say happened. No speculation."),
        isAiTech: z.boolean().describe("True only if this is genuinely about AI or technology."),
        importance: z.number().min(0).max(10).describe("Technological / industry significance."),
        novelty: z.number().min(0).max(10).describe("How new this is. Reposts of old news score low."),
        discussability: z.number().min(0).max(10).describe("Likelihood of meaningful discussion among developers and IT professionals."),
        devRelevance: z.number().min(0).max(10).describe("Relevance to developers and IT professionals."),
        viralButShallow: z.boolean().describe("True if attention is driven by humor/controversy rather than substance."),
        repostOfOldNews: z.boolean().describe("True if this is old news being re-shared without a new development."),
        topicKey: z.string().describe("Short slug identifying the topic, e.g. 'openai-gpt-release', 'humanoid-robot-funding'."),
        primaryEntity: z.string().describe("The main company, lab, product or project the story is about, e.g. 'OpenAI', 'Apple', 'DeepSeek'."),
        rationale: z.string().describe("One sentence on why it scored this way."),
      }),
    )
    .max(70),
});

export interface ClusterResult {
  headline: string;
  memberIds: number[];
  category: Category;
  tags: string[];
  whatHappened: string;
  assessment: AiAssessment;
}

const SYSTEM = `You are a senior technology editor with deep knowledge of AI, software, hardware and the developer ecosystem. You are triaging a raw feed of items collected in the last two days from news outlets, company blogs, Hacker News, Reddit, GitHub, Hugging Face, arXiv, YouTube and news aggregators.

Your job:
1. Group entries that describe the SAME underlying event into one cluster (a launch covered by TechCrunch, discussed on Hacker News, posted on Reddit and explained on YouTube is ONE story). Entries about different events must stay separate even if they share a company name.
2. Drop entries that are not about AI or technology, are advertising, listicles, deals, or pure noise. Do not include them in any cluster.
3. For each cluster give an honest editorial assessment. Important is not the same as viral; latest is not the same as important. Reward genuine technological significance, novelty, usefulness to developers and IT professionals, and potential for meaningful discussion. Penalise stories that are old news re-shared, incremental PR, or attention driven by humour or outrage.
4. Never invent facts. "whatHappened" must only restate what the input titles/snippets say. If the inputs are vague, say so.

Aim for at most 60 clusters, prioritising the strongest ones. Every entry that belongs to a kept cluster must appear in exactly one memberIds list. Include lone entries as single-member clusters only when they are notable on their own (e.g. an official lab announcement or a fast-rising GitHub project).`;

export async function clusterWithModel(
  pre: PreCluster[],
): Promise<ClusterResult[]> {
  const lines = pre.map((pc) => {
    const head = pc.items[0];
    const srcs = new Map<string, string>();
    for (const it of pc.items) {
      const e = it.engagement;
      const eng = [
        e.points != null ? `${e.points} pts` : null,
        e.upvotes != null ? `${e.upvotes} up` : null,
        e.comments ? `${e.comments} cmts` : null,
        e.stars ? `${e.stars} stars` : null,
        e.views ? `${e.views} views` : null,
        e.likes ? `${e.likes} likes` : null,
      ]
        .filter(Boolean)
        .join(", ");
      srcs.set(it.source, eng);
      for (const m of it.mentions ?? []) {
        const me = m.engagement;
        srcs.set(
          m.source,
          [me.points != null ? `${me.points} pts` : null, me.upvotes != null ? `${me.upvotes} up` : null, me.comments ? `${me.comments} cmts` : null]
            .filter(Boolean)
            .join(", "),
        );
      }
    }
    const srcStr = [...srcs.entries()].map(([s, e]) => (e ? `${s} [${e}]` : s)).join("; ");
    const age = Math.round(hoursSince(head.publishedAt));
    const titles = pc.items.length > 1 ? ` | also titled: ${pc.items.slice(1, 3).map((i) => `"${truncate(i.title, 80)}"`).join(", ")}` : "";
    return `#${pc.id} (${age}h ago) "${truncate(head.title, 140)}"${titles}\n   sources: ${srcStr}\n   ${head.summary ? "snippet: " + truncate(head.summary, 220) : ""}`.trimEnd();
  });

  const user = `Today is ${new Date().toUTCString()}.\n\nEntries (${pre.length}):\n\n${lines.join("\n\n")}`;
  const result = await structured(ClusterSchema, SYSTEM, user, { effort: "high", maxTokens: 24000, cacheSystem: true });

  const valid = new Set(pre.map((p) => p.id));
  const used = new Set<number>();
  const out: ClusterResult[] = [];
  for (const c of result.clusters) {
    const members = c.memberIds.filter((id) => valid.has(id) && !used.has(id));
    if (!members.length) continue;
    for (const m of members) used.add(m);
    out.push({
      headline: c.headline,
      memberIds: members,
      category: c.category,
      tags: c.tags,
      whatHappened: c.whatHappened,
      assessment: {
        isAiTech: c.isAiTech,
        importance: c.importance,
        novelty: c.novelty,
        discussability: c.discussability,
        devRelevance: c.devRelevance,
        viralButShallow: c.viralButShallow,
        repostOfOldNews: c.repostOfOldNews,
        rationale: c.rationale,
        topicKey: c.topicKey,
        primaryEntity: c.primaryEntity,
      },
    });
  }
  return out;
}
