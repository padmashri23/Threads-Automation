import { z } from "zod";
import type { FactCheck, Story } from "../types";
import { structured } from "../ai/client";
import { extractArticle } from "../extract";
import { OFFICIAL_DOMAINS, TIER1_DOMAINS } from "./scoring";
import { truncate } from "../utils";

const FactCheckSchema = z.object({
  status: z.enum(["official", "reliable", "early", "rumor", "unverified", "conflicting"]),
  statusReason: z.string().describe("One sentence explaining the status."),
  confirmed: z
    .array(
      z.object({
        claim: z.string(),
        sourceUrl: z.string().describe("Must be one of the fetched source URLs that states this claim."),
        sourceName: z.string(),
      }),
    )
    .describe("Claims explicitly supported by the fetched source text."),
  unverified: z.array(z.string()).describe("Claims that appear in headlines/snippets but are not supported by any fetched text."),
  conflicting: z.array(z.string()).describe("Points where sources disagree."),
  factSheet: z
    .array(z.string())
    .describe("Compact list of verified facts (with numbers, names, dates exactly as stated in sources) that a writer may use. Nothing here may be unverified."),
});

const SYSTEM = `You are a meticulous fact-checker for a technology editor. You receive a story (headline, what happened, the original item titles/snippets) plus the full text of one or more fetched source pages.

Rules:
- A claim is CONFIRMED only if the fetched source text explicitly states it. Headlines and snippets alone do not confirm anything.
- Never add information from your own memory. If the fetched text does not contain a number, quote, feature, date, or name, it is not confirmed.
- Statistics, quotes, product features, funding amounts, user numbers, dates and benchmark/performance claims need explicit support.
- status: "official" if an official/primary source (the company, lab, repository, or paper) confirms the core event; "reliable" if reputable journalism confirms it; "early" if only one non-primary source; "rumor" if sources frame it as rumor/leak/unnamed sources; "unverified" if no fetched text confirms the core event; "conflicting" if sources disagree on material facts.
- The factSheet must be reusable by a writer without further checking: precise, attributed, and free of speculation. Mark attribution inline, e.g. "(per TechCrunch)" or "(official blog)".`;

function rankUrl(url: string, kind: string): number {
  let d = "";
  try {
    d = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return 9;
  }
  if (kind === "official" || OFFICIAL_DOMAINS.some((o) => d === o || d.endsWith("." + o))) return 0;
  if (TIER1_DOMAINS.some((o) => d === o || d.endsWith("." + o))) return 1;
  if (kind === "publication") return 2;
  if (kind === "research" || d === "github.com" || d === "huggingface.co") return 3;
  if (url.includes("news.google.com")) return 8;
  return 5;
}

export async function verifyStory(story: Story): Promise<FactCheck> {
  const candidates = [...story.sources]
    .filter((s) => s.label !== "Discussion thread" && !["social", "video"].includes(s.kind))
    .map((s) => ({ ...s, rank: rankUrl(s.url, s.kind) }))
    .sort((a, b) => a.rank - b.rank)
    .filter((s) => s.rank < 8)
    .slice(0, 4);

  // Always include a discussion page when nothing else is fetchable (e.g. an HN self-post).
  if (!candidates.length) {
    const any = story.sources.find((s) => !s.url.includes("news.google.com"));
    if (any) candidates.push({ ...any, rank: 9 });
  }

  const pages = await Promise.all(candidates.map((c) => extractArticle(c.url)));
  const fetched = pages.filter((p) => p.ok).slice(0, 3);
  const checkedUrls = fetched.map((p) => p.url);

  if (!fetched.length) {
    return {
      status: story.credibility === "official" ? "early" : "unverified",
      statusReason: "No source page could be fetched for verification; only headlines and snippets are available.",
      confirmed: [],
      unverified: [story.whatHappened],
      conflicting: [],
      factSheet: [],
      checkedUrls: candidates.map((c) => c.url),
      checkedAt: new Date().toISOString(),
    };
  }

  const itemLines = story.items
    .slice(0, 12)
    .map((i) => `- [${i.source}] ${i.title}${i.summary ? " — " + truncate(i.summary, 200) : ""}`)
    .join("\n");
  const pageBlocks = fetched
    .map((p, i) => {
      const name = candidates.find((c) => c.url === p.url)?.name ?? p.url;
      return `=== SOURCE ${i + 1}: ${name} (${p.url}) ===\nTitle: ${p.title}\n${p.text}`;
    })
    .join("\n\n");

  const user = `STORY\nHeadline: ${story.headline}\nWhat happened (from triage): ${story.whatHappened}\nCategory: ${story.category}\n\nORIGINAL ITEMS\n${itemLines}\n\nFETCHED SOURCE TEXT\n${pageBlocks}`;

  const r = await structured(FactCheckSchema, SYSTEM, user, { effort: "high", maxTokens: 6000, cacheSystem: true });
  const allowed = new Set(checkedUrls);
  return {
    status: r.status,
    statusReason: r.statusReason,
    confirmed: r.confirmed.filter((c) => allowed.has(c.sourceUrl) || checkedUrls.some((u) => c.sourceUrl.startsWith(u))),
    unverified: r.unverified,
    conflicting: r.conflicting,
    factSheet: r.factSheet,
    checkedUrls,
    checkedAt: new Date().toISOString(),
  };
}
