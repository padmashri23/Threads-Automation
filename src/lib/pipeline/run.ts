import type { HistoryEntry, RawItem, Run, Story } from "../types";
import { collectAll } from "../sources";
import { getHistory, getSettings, saveRun, saveStories, upsertHistory } from "../store";
import { isRelevant, preScore } from "./relevance";
import { clusterWithModel, mergeByUrl, preCluster } from "./cluster";
import { credibilityAdjustment, scoreCluster } from "./scoring";
import { verifyStory } from "./verify";
import { checkRepeats } from "./history";
import { generatePost } from "./generate";
import { generateVisuals } from "../visuals";
import { aiConcurrency, hasApiKey, SETUP_MESSAGE } from "../ai/client";
import { clamp, nowIso, pLimitAll, round } from "../utils";

const MAX_TO_MODEL = 320;
const VERIFY_TOP = 6;
const THRESHOLDS = { overall: 55, quality: 50, trend: 28 };

type Global = typeof globalThis & { __activeRun?: Run | null };
const g = globalThis as Global;

export function getActiveRun(): Run | null {
  return g.__activeRun ?? null;
}

function newRunId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `run${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function startRun(): Run {
  if (g.__activeRun && g.__activeRun.status === "running") return g.__activeRun;
  const run: Run = {
    id: newRunId(),
    startedAt: nowIso(),
    status: "running",
    progress: { stage: "starting", message: "Preparing research run", pct: 0, log: [] },
    stats: { sourcesQueried: 0, sourcesOk: 0, itemsCollected: 0, itemsRelevant: 0, clusters: 0, candidates: 0, sourceReports: [] },
    storyIds: [],
    topPicks: [],
    runnerUps: [],
    editorNote: "",
  };
  g.__activeRun = run;
  saveRun(run);
  void executeRun(run).catch((e) => {
    run.status = "error";
    run.error = (e as Error).message;
    run.finishedAt = nowIso();
    run.progress.message = `Failed: ${run.error}`;
    saveRun(run);
  });
  return run;
}

function progress(run: Run, stage: string, message: string, pct: number) {
  run.progress = { stage, message, pct: clamp(round(pct), 0, 100), log: [...run.progress.log.slice(-40), `${new Date().toLocaleTimeString()} · ${message}`] };
  saveRun(run);
}

async function executeRun(run: Run) {
  if (!hasApiKey()) throw new Error(SETUP_MESSAGE);
  const settings = getSettings();

  // 1. Collect
  progress(run, "collecting", "Scanning sources…", 2);
  const { items, reports } = await collectAll(settings.lookbackHours, (done, total, name) => {
    progress(run, "collecting", `Scanned ${done}/${total} sources (${name})`, 2 + (done / total) * 33);
  });
  run.stats.sourcesQueried = reports.length;
  run.stats.sourcesOk = reports.filter((r) => r.ok).length;
  run.stats.itemsCollected = items.length;
  run.stats.sourceReports = reports;
  progress(run, "filtering", `Collected ${items.length} items from ${run.stats.sourcesOk} sources. Filtering noise…`, 36);

  // 2. Filter + merge
  const relevant = items.filter(isRelevant);
  const merged = mergeByUrl(relevant);
  run.stats.itemsRelevant = merged.length;
  const now = Date.now();
  // Group near-identical headlines first (so wire-service duplicates attach to their primary item),
  // then keep the strongest groups for the model. Multi-source groups always outrank singletons.
  const groupsAll = preCluster(merged);
  const groupScore = (g: { items: RawItem[] }) => {
    const mentions = g.items.reduce((n, i) => n + 1 + (i.mentions?.length ?? 0), 0);
    return Math.max(...g.items.map((i) => preScore(i, now))) + Math.min(40, (mentions - 1) * 10);
  };
  // Diversity quota: the strongest groups overall, plus the strongest of each source kind, so that
  // official announcements, wire coverage, research and developer projects are all represented.
  const sorted = groupsAll.sort((a, b) => groupScore(b) - groupScore(a));
  const quota: Record<string, number> = { official: 60, publication: 90, aggregator: 90, research: 30, developer: 45, community: 70, social: 40, video: 25 };
  const chosen = new Set<(typeof sorted)[number]>();
  for (const g of sorted.slice(0, Math.floor(MAX_TO_MODEL * 0.45))) chosen.add(g);
  const perKind: Record<string, number> = {};
  for (const g of sorted) {
    if (chosen.size >= MAX_TO_MODEL) break;
    const kind = g.items[0].sourceKind;
    if ((perKind[kind] ?? 0) >= (quota[kind] ?? 20)) continue;
    perKind[kind] = (perKind[kind] ?? 0) + 1;
    chosen.add(g);
  }
  const pre = sorted
    .filter((g) => chosen.has(g))
    .map((g, i) => ({ id: i, items: g.items.sort((a, b) => preScore(b, now) - preScore(a, now)) }));
  progress(run, "clustering", `${merged.length} relevant items → ${groupsAll.length} groups, top ${pre.length} sent for editorial triage…`, 40);

  // 3. Model clustering + assessment
  const clusters = await clusterWithModel(pre);
  run.stats.clusters = clusters.length;
  progress(run, "scoring", `Identified ${clusters.length} distinct stories. Scoring trend momentum and editorial quality…`, 58);

  // 4. Score
  const byPreId = new Map(pre.map((p) => [p.id, p.items]));
  let stories: Story[] = clusters.map((c, idx) => {
    const members: RawItem[] = c.memberIds.flatMap((id) => byPreId.get(id) ?? []);
    const s = scoreCluster(members, c.assessment, now);
    return {
      id: `${run.id}-${idx + 1}`,
      runId: run.id,
      headline: c.headline,
      whatHappened: c.whatHappened,
      summary: c.whatHappened,
      whyItMatters: c.assessment.rationale,
      category: c.category,
      tags: c.tags,
      items: members,
      sources: s.sources,
      sourceCount: s.sources.length,
      independentSourceCount: s.independentSourceCount,
      trendScore: s.trendScore,
      qualityScore: s.qualityScore,
      overallScore: s.overallScore,
      trendReasons: s.reasons,
      signals: s.signals,
      freshness: s.freshness,
      credibility: s.credibility,
      credibilityLabel: s.credibilityLabel,
      relatedStoryIds: [],
      assessment: c.assessment,
      selected: false,
      createdAt: nowIso(),
    };
  });
  // Related stories: same category or same topicKey family
  for (const s of stories) {
    s.relatedStoryIds = stories
      .filter((o) => o.id !== s.id && (o.assessment.topicKey.split("-")[0] === s.assessment.topicKey.split("-")[0] || o.category === s.category))
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 4)
      .map((o) => o.id);
  }
  // Personal topic preferences: a small nudge for preferred topics, a strong penalty for avoided ones.
  const matches = (s: Story, topics: string[]) => {
    const hay = `${s.headline} ${s.category} ${s.tags.join(" ")} ${s.whatHappened}`.toLowerCase();
    return topics.map((t) => t.toLowerCase().trim()).filter(Boolean).find((t) => hay.includes(t));
  };
  for (const s of stories) {
    const avoid = matches(s, settings.avoidTopics);
    if (avoid) {
      s.overallScore = clamp(round(s.overallScore - 20), 0, 100);
      s.selectionNote = `Down-ranked: matches a topic you asked to avoid ("${avoid}").`;
      continue;
    }
    const pref = matches(s, settings.preferredTopics);
    if (pref) {
      s.overallScore = clamp(round(s.overallScore + 3), 0, 100);
      s.trendReasons = [...s.trendReasons, `Matches a topic you prefer (${pref})`];
    }
  }
  stories.sort((a, b) => b.overallScore - a.overallScore);
  run.storyIds = stories.map((s) => s.id);
  saveStories(run.id, stories);

  // 5. Repeat check against history
  const candidates = stories
    .filter((s) => s.assessment.isAiTech && !s.assessment.repostOfOldNews && !s.selectionNote?.startsWith("Down-ranked"))
    .slice(0, 12);
  run.stats.candidates = candidates.length;
  progress(run, "history", `Checking ${candidates.length} candidates against your recent content…`, 62);
  const history = getHistory();
  const repeats = await checkRepeats(candidates, history);
  for (const c of candidates) {
    const r = repeats.get(c.id);
    if (r) c.repeat = r;
    if (r?.verdict === "same-story") c.selectionNote = `Skipped: already covered (${r.historyHeadline ?? "recent post"}).`;
  }
  const eligible = candidates.filter((c) => c.repeat?.verdict !== "same-story");

  // 6. Verify top candidates
  const toVerify = eligible.slice(0, VERIFY_TOP);
  progress(run, "verifying", `Verifying the top ${toVerify.length} stories against original sources…`, 66);
  let verified = 0;
  await pLimitAll(
    toVerify.map((s) => async () => {
      try {
        s.factCheck = await verifyStory(s);
        s.credibility = s.factCheck.status;
        s.credibilityLabel = s.factCheck.statusReason;
        s.qualityScore = clamp(round(s.qualityScore + credibilityAdjustment(s.factCheck.status)), 0, 100);
        s.overallScore = clamp(round(s.trendScore * 0.5 + s.qualityScore * 0.5), 0, 100);
        if (s.factCheck.status === "official") s.trendReasons = [...new Set(["Confirmed by an official source", ...s.trendReasons])];
      } catch (e) {
        s.selectionNote = `Verification failed: ${(e as Error).message}`;
      } finally {
        verified++;
        progress(run, "verifying", `Verified ${verified}/${toVerify.length} stories`, 66 + (verified / toVerify.length) * 16);
      }
    }),
    aiConcurrency(),
  );

  // 7. Select the best two (different topics)
  progress(run, "selecting", "Selecting today's two stories…", 84);
  const ranked = [...toVerify].sort((a, b) => b.overallScore - a.overallScore);
  const passes = (s: Story) =>
    s.overallScore >= THRESHOLDS.overall &&
    s.qualityScore >= THRESHOLDS.quality &&
    s.trendScore >= THRESHOLDS.trend &&
    !["rumor", "unverified"].includes(s.credibility);
  const picks: Story[] = [];
  const notes: string[] = [];
  const passing: Story[] = [];
  for (const s of ranked) {
    if (passes(s)) {
      passing.push(s);
      continue;
    }
    if (!s.selectionNote) {
      s.selectionNote =
        s.credibility === "unverified" || s.credibility === "rumor"
          ? `Not selected: could not be verified (${s.credibilityLabel}).`
          : s.qualityScore < THRESHOLDS.quality
            ? "Not selected: editorial quality below the bar."
            : s.trendScore < THRESHOLDS.trend
              ? "Not selected: not enough trend momentum yet."
              : "Not selected: overall score below the bar.";
    }
  }
  if (passing.length) {
    const first = passing[0];
    picks.push(first);
    const entity = (s: Story) => (s.assessment.primaryEntity ?? "").trim().toLowerCase();
    const sameTopic = (s: Story) =>
      first.assessment.topicKey === s.assessment.topicKey ||
      (first.relatedStoryIds.includes(s.id) && first.category === s.category && first.assessment.topicKey.split("-")[0] === s.assessment.topicKey.split("-")[0]);
    const others = passing.slice(1).filter((s) => {
      if (sameTopic(s)) {
        s.selectionNote = "Not selected as #2: too close to the #1 story.";
        return false;
      }
      return true;
    });
    if (others.length) {
      // Prefer a different company/lab for the second slot when an equally strong alternative exists.
      let second = others[0];
      if (entity(second) && entity(second) === entity(first)) {
        const alt = others.find((s) => entity(s) !== entity(first) && s.overallScore >= second.overallScore - 6);
        if (alt) {
          second.selectionNote = `Not selected as #2: same company as #1 (${first.assessment.primaryEntity}); a different story of similar strength was preferred.`;
          second = alt;
        }
      }
      picks.push(second);
    }
    for (const s of passing) if (!picks.includes(s) && !s.selectionNote) s.selectionNote = "Cleared the bar but ranked below today's two picks.";
  }
  picks.forEach((p, i) => {
    p.selected = true;
    p.rank = i + 1;
    p.selectionNote = i === 0 ? "Selected as today's top story." : "Selected as today's second story.";
  });
  run.topPicks = picks.map((p) => p.id);
  run.runnerUps = ranked.filter((s) => !s.selected).slice(0, 4).map((s) => s.id);
  if (picks.length === 0) notes.push("No story met the quality and verification bar today. Better to post nothing than something weak; check the Discover page for what was considered.");
  else if (picks.length === 1) notes.push("Only one story cleared the bar today. The second slot was left empty rather than filled with something mediocre.");
  else notes.push("Two distinct stories cleared the quality, trend and verification bar.");
  const skipped = candidates.filter((c) => c.repeat?.verdict === "same-story").length;
  if (skipped) notes.push(`${skipped} candidate${skipped > 1 ? "s were" : " was"} skipped because you already covered ${skipped > 1 ? "them" : "it"}.`);
  run.editorNote = notes.join(" ");

  // 8. Write posts
  let written = 0;
  for (const p of picks) {
    progress(run, "writing", `Writing Threads post ${written + 1}/${picks.length}…`, 86 + (written / Math.max(1, picks.length)) * 12);
    try {
      p.post = await generatePost(p, settings);
    } catch (e) {
      p.selectionNote += ` Post generation failed: ${(e as Error).message}`;
    }
    if (settings.visualsMode !== "never" && p.post) {
      progress(run, "writing", `Designing image cards for story ${written + 1}/${picks.length}…`, 88 + (written / Math.max(1, picks.length)) * 10);
      try {
        p.visuals = await generateVisuals(p, settings, settings.visualsMode === "always" ? "carousel" : "auto");
      } catch (e) {
        run.progress.log.push(`Image cards skipped for "${p.headline.slice(0, 50)}": ${(e as Error).message}`);
      }
    }
    written++;
  }

  // Persist stories with all updates
  stories = stories.map((s) => (toVerify.find((v) => v.id === s.id) ?? candidates.find((c) => c.id === s.id) ?? s));
  stories.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.overallScore - a.overallScore);
  saveStories(run.id, stories);

  // 9. Record picks in history (status: suggested)
  for (const p of picks) {
    const entry: HistoryEntry = {
      id: `h-${p.id}`,
      date: nowIso(),
      runId: run.id,
      storyId: p.id,
      headline: p.headline,
      summary: p.whatHappened,
      category: p.category,
      topicKey: p.assessment.topicKey,
      trendScore: p.trendScore,
      qualityScore: p.qualityScore,
      post: p.post?.text ?? "",
      status: "suggested",
      sources: p.sources.slice(0, 8),
    };
    upsertHistory(entry);
  }

  run.status = "done";
  run.finishedAt = nowIso();
  progress(run, "done", picks.length ? `Done. ${picks.length} stor${picks.length > 1 ? "ies" : "y"} selected.` : "Done. Nothing met the bar today.", 100);
}
