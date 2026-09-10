import type { AiAssessment, Credibility, Engagement, RawItem, SignalBreakdown, SourceRef } from "../types";
import { clamp, formatNumber, hoursSince, round, timeAgo } from "../utils";

export const OFFICIAL_DOMAINS = [
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "blog.google",
  "research.google",
  "ai.google",
  "ai.meta.com",
  "about.fb.com",
  "microsoft.com",
  "nvidia.com",
  "mistral.ai",
  "x.ai",
  "huggingface.co",
  "github.blog",
  "apple.com",
  "amazon.com",
  "aws.amazon.com",
  "cloudflare.com",
  "arxiv.org",
  "deepseek.com",
  "qwenlm.github.io",
  "ai21.com",
  "cohere.com",
  "stability.ai",
  "perplexity.ai",
  "cursor.com",
  "anysphere.inc",
  "vercel.com",
  "mozilla.org",
  "blogs.nvidia.com",
  "developer.nvidia.com",
  "machinelearning.apple.com",
];

export const TIER1_DOMAINS = [
  "techcrunch.com",
  "theverge.com",
  "wired.com",
  "arstechnica.com",
  "technologyreview.com",
  "news.mit.edu",
  "reuters.com",
  "bloomberg.com",
  "wsj.com",
  "nytimes.com",
  "ft.com",
  "cnbc.com",
  "theinformation.com",
  "venturebeat.com",
  "zdnet.com",
  "axios.com",
  "semafor.com",
  "bbc.com",
  "bbc.co.uk",
  "theguardian.com",
  "spectrum.ieee.org",
  "nature.com",
  "science.org",
  "theregister.com",
  "engadget.com",
  "techradar.com",
  "the-decoder.com",
  "washingtonpost.com",
  "economist.com",
  "404media.co",
  "platformer.news",
  "simonwillison.net",
];

function isOfficialDomain(d: string): boolean {
  return OFFICIAL_DOMAINS.some((o) => d === o || d.endsWith("." + o));
}
function isTier1(d: string): boolean {
  return TIER1_DOMAINS.some((o) => d === o || d.endsWith("." + o));
}

function log(n: number): number {
  return Math.log10(1 + Math.max(0, n));
}

interface Mention {
  source: string;
  url: string;
  engagement: Engagement;
  publishedAt: string;
  kind: string;
  domain: string;
}

function flatten(items: RawItem[]): Mention[] {
  const out: Mention[] = [];
  for (const it of items) {
    out.push({ source: it.source, url: it.discussionUrl ?? it.url, engagement: it.engagement, publishedAt: it.publishedAt, kind: it.sourceKind, domain: it.domain });
    for (const m of it.mentions ?? []) {
      const kind = m.source.startsWith("Reddit") || m.source.startsWith("X ") ? "social" : m.source === "Hacker News" || m.source === "Lobsters" ? "community" : m.source.startsWith("YouTube") ? "video" : "other";
      out.push({ source: m.source, url: m.url, engagement: m.engagement, publishedAt: m.publishedAt, kind, domain: "" });
    }
  }
  return out;
}

export interface ScoreResult {
  trendScore: number;
  qualityScore: number;
  overallScore: number;
  signals: SignalBreakdown;
  reasons: string[];
  credibility: Credibility;
  credibilityLabel: string;
  sources: SourceRef[];
  independentSourceCount: number;
  freshness: { latestAt: string; earliestAt: string; label: string; hoursOld: number };
}

export function scoreCluster(items: RawItem[], assessment: AiAssessment, now = Date.now()): ScoreResult {
  const mentions = flatten(items);
  const reasons: string[] = [];

  // --- Coverage: independent outlets (publications / aggregators / official), by domain ---
  const outletDomains = new Set<string>();
  const outletNames: string[] = [];
  let hasOfficial = false;
  let officialName = "";
  let tier1Count = 0;
  for (const it of items) {
    if (["publication", "aggregator", "official"].includes(it.sourceKind) && it.domain) {
      if (!outletDomains.has(it.domain)) {
        outletDomains.add(it.domain);
        outletNames.push(it.source.replace(" (via Google News)", ""));
      }
    }
    if (it.sourceKind === "official" || isOfficialDomain(it.domain)) {
      hasOfficial = true;
      officialName = officialName || it.source;
    }
    if (isTier1(it.domain)) tier1Count++;
  }
  const independent = outletDomains.size;
  let coverage = independent <= 1 ? (independent ? 4 : 0) : independent === 2 ? 12 : independent === 3 ? 18 : independent === 4 ? 23 : 28;
  if (tier1Count >= 2) coverage += 4;
  coverage = clamp(coverage, 0, 30);
  if (independent >= 2) reasons.push(`Covered by ${independent} independent outlets (${outletNames.slice(0, 4).join(", ")}${outletNames.length > 4 ? ", …" : ""})`);
  else if (independent === 1 && tier1Count) reasons.push(`Reported by ${outletNames[0]}`);

  // --- Discussion velocity: HN / Reddit / Lobsters / X ---
  let discussion = 0;
  let best: { source: string; pts: number; cmts: number; hrs: number; url: string } | null = null;
  let discussionVenues = 0;
  for (const m of mentions) {
    const pts = (m.engagement.points ?? 0) + (m.engagement.upvotes ?? 0) + (m.engagement.likes && m.kind === "social" ? m.engagement.likes / 5 : 0);
    const cmts = m.engagement.comments ?? 0;
    if (pts <= 0 && cmts <= 0) {
      if (["community", "social"].includes(m.kind)) discussionVenues += 0.5;
      continue;
    }
    discussionVenues++;
    const hrs = Math.max(1, hoursSince(m.publishedAt, now));
    const velocity = pts / hrs;
    const s = log(pts) * 6 + log(cmts) * 4 + Math.min(8, velocity / 8);
    discussion += s;
    if (!best || pts > best.pts) best = { source: m.source, pts, cmts, hrs, url: m.url };
  }
  discussion = clamp(discussion, 0, 25);
  if (best && best.pts >= 30) {
    reasons.push(`${formatNumber(Math.round(best.pts))} points and ${formatNumber(best.cmts)} comments on ${best.source.replace(/ ·.*$/, "")} in ${Math.round(best.hrs)}h`);
  }
  if (discussionVenues >= 2) reasons.push(`Active discussion across ${Math.round(discussionVenues)} community/social venues`);

  // --- Developer traction ---
  let developer = 0;
  for (const it of items) {
    const e = it.engagement;
    if (e.stars) {
      const days = Math.max(0.5, hoursSince(it.publishedAt, now) / 24);
      const perDay = e.stars / days;
      developer += log(e.stars) * 3 + Math.min(6, perDay / 150);
      reasons.push(`GitHub project at ${formatNumber(e.stars)} stars (~${formatNumber(Math.round(perDay))}/day)`);
    }
    if (e.downloads) developer += Math.min(5, log(e.downloads) * 1.2);
    if (e.likes && it.domain === "huggingface.co") developer += Math.min(4, log(e.likes) * 1.5);
    if (it.source === "Hugging Face Papers" && (e.upvotes ?? 0) >= 20) {
      developer += Math.min(6, log(e.upvotes ?? 0) * 3);
      reasons.push(`${e.upvotes} upvotes on Hugging Face Papers`);
    }
  }
  developer = clamp(developer, 0, 15);

  // --- Official source present ---
  const official = hasOfficial ? 10 : 0;
  if (hasOfficial) reasons.push(`Official/primary source available (${officialName.replace(" (via Google News)", "")})`);

  // --- Freshness & momentum ---
  const times = mentions.map((m) => Date.parse(m.publishedAt)).filter((t) => !Number.isNaN(t));
  const latest = times.length ? Math.max(...times) : now;
  const earliest = times.length ? Math.min(...times) : now;
  const hoursOld = (now - earliest) / 36e5; // age of the story = first appearance
  const hoursLatest = (now - latest) / 36e5;
  let freshness = hoursOld < 6 ? 15 : hoursOld < 12 ? 13 : hoursOld < 24 ? 10 : hoursOld < 36 ? 6 : hoursOld < 48 ? 3 : 1;
  // Momentum: story is a few hours old and still gaining new mentions
  if (hoursOld > 3 && hoursLatest < 6 && mentions.length >= 3) {
    freshness = Math.min(15, freshness + 3);
    reasons.push("Still gaining new coverage hours after it first appeared");
  }
  const freshLabel = hoursOld < 6 ? "Breaking" : hoursOld < 24 ? "Fresh" : hoursOld < 48 ? "Recent" : "Older";
  reasons.push(`First appeared ${timeAgo(new Date(earliest).toISOString())}`);

  // --- Video ---
  let video = 0;
  const vids = items.filter((i) => i.sourceKind === "video");
  const views = vids.reduce((a, v) => a + (v.engagement.views ?? 0), 0);
  if (vids.length) {
    video = clamp(vids.length * 1.5 + log(views), 0, 5);
    reasons.push(`YouTube coverage: ${vids.length} video${vids.length > 1 ? "s" : ""}${views ? ` (${formatNumber(views)} views)` : ""}`);
  }

  const signals: SignalBreakdown = {
    coverage: round(coverage),
    discussion: round(discussion),
    developer: round(developer),
    official: round(official),
    freshness: round(freshness),
    video: round(video),
  };
  const trendScore = clamp(round(coverage + discussion + developer + official + freshness + video), 0, 100);

  // --- Quality (editorial) ---
  const a = assessment;
  let quality = a.importance * 3.5 + a.novelty * 2 + a.discussability * 2 + a.devRelevance * 2.5;
  if (a.viralButShallow) quality -= 18;
  if (a.repostOfOldNews) quality -= 30;
  if (!a.isAiTech) quality -= 40;
  const qualityScore = clamp(round(quality), 0, 100);

  // --- Credibility (pre-verification heuristic) ---
  let credibility: Credibility;
  let credibilityLabel: string;
  if (hasOfficial) {
    credibility = "official";
    credibilityLabel = "Official source present";
  } else if (tier1Count >= 1 && independent >= 2) {
    credibility = "reliable";
    credibilityLabel = "Multiple reliable outlets";
  } else if (tier1Count >= 1) {
    credibility = "reliable";
    credibilityLabel = "Reported by a reliable outlet";
  } else if (independent >= 1) {
    credibility = "early";
    credibilityLabel = "Early report, single outlet";
  } else {
    credibility = "unverified";
    credibilityLabel = "Community/social only, not yet verified";
  }

  // --- Sources list ---
  const sources: SourceRef[] = [];
  const seenUrl = new Set<string>();
  const push = (ref: SourceRef) => {
    if (seenUrl.has(ref.url)) return;
    seenUrl.add(ref.url);
    sources.push(ref);
  };
  for (const it of items) {
    const e = it.engagement;
    const label =
      it.sourceKind === "official"
        ? "Official announcement"
        : it.sourceKind === "publication"
          ? "Reporting"
          : it.sourceKind === "aggregator"
            ? "Reporting"
            : it.sourceKind === "community"
              ? `Discussion${e.points != null ? ` (${e.points} points, ${e.comments ?? 0} comments)` : ""}`
              : it.sourceKind === "social"
                ? `Social${e.upvotes != null ? ` (${e.upvotes} upvotes)` : e.likes ? ` (${e.likes} likes)` : ""}`
                : it.sourceKind === "developer"
                  ? `Developer${e.stars ? ` (${formatNumber(e.stars)} stars)` : e.likes ? ` (${e.likes} likes)` : ""}`
                  : it.sourceKind === "research"
                    ? `Paper${e.upvotes ? ` (${e.upvotes} upvotes)` : ""}`
                    : it.sourceKind === "video"
                      ? `Video${e.views ? ` (${formatNumber(e.views)} views)` : ""}`
                      : "Source";
    push({ name: it.source.replace(" (via Google News)", ""), url: it.url, kind: it.sourceKind, label, publishedAt: it.publishedAt });
    if (it.discussionUrl && it.discussionUrl !== it.url) {
      push({ name: it.source, url: it.discussionUrl, kind: it.sourceKind, label: "Discussion thread", publishedAt: it.publishedAt });
    }
    for (const m of it.mentions ?? []) {
      const me = m.engagement;
      const mkind = m.source.startsWith("Reddit") || m.source.startsWith("X ") ? "social" : m.source.startsWith("YouTube") ? "video" : "community";
      push({
        name: m.source,
        url: m.url,
        kind: mkind,
        label: `Discussion${me.points != null ? ` (${me.points} points)` : me.upvotes != null ? ` (${me.upvotes} upvotes)` : ""}`,
        publishedAt: m.publishedAt,
      });
    }
  }
  const kindOrder: Record<string, number> = { official: 0, publication: 1, aggregator: 2, research: 3, developer: 4, community: 5, social: 6, video: 7 };
  sources.sort((x, y) => (kindOrder[x.kind] ?? 9) - (kindOrder[y.kind] ?? 9));

  const overallScore = clamp(round(trendScore * 0.5 + qualityScore * 0.5), 0, 100);

  return {
    trendScore,
    qualityScore,
    overallScore,
    signals,
    reasons: dedupe(reasons),
    credibility,
    credibilityLabel,
    sources,
    independentSourceCount: independent,
    freshness: { latestAt: new Date(latest).toISOString(), earliestAt: new Date(earliest).toISOString(), label: freshLabel, hoursOld: round(hoursOld, 1) },
  };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

/** Adjust quality after fact-checking. */
export function credibilityAdjustment(status: Credibility): number {
  switch (status) {
    case "official":
      return 5;
    case "reliable":
      return 2;
    case "early":
      return -5;
    case "unverified":
      return -15;
    case "rumor":
      return -20;
    case "conflicting":
      return -12;
  }
}
