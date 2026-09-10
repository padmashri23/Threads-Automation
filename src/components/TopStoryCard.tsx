"use client";

import { useState } from "react";
import Link from "next/link";
import type { Story } from "@/lib/types";
import { CategoryChip, CredibilityChip, FreshnessChip } from "./Badges";
import { ScoreRing } from "./ScoreRing";
import { SourceList } from "./SourceList";
import { ThreadsEditor } from "./ThreadsEditor";
import { VisualsPanel } from "./VisualsPanel";
import { TrendingUp, Link2, ChevronDown } from "lucide-react";

export function TopStoryCard({ story: initial }: { story: Story }) {
  const [story, setStory] = useState(initial);
  const [showSources, setShowSources] = useState(false);
  const rank = story.rank ?? 1;

  return (
    <article className="card overflow-hidden">
      <div className="border-b border-border bg-surface-2/60 px-5 py-3 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
          <TrendingUp size={16} /> #{rank} {rank === 1 ? "TOP STORY" : "SECOND STORY"}
        </span>
        <CategoryChip category={story.category} />
        <FreshnessChip label={story.freshness.label} hoursOld={story.freshness.hoursOld} />
        <CredibilityChip credibility={story.credibility} title={story.credibilityLabel} />
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight">
              <Link href={`/story/${story.id}`} className="hover:underline">
                {story.headline}
              </Link>
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">{story.whatHappened}</p>
            {story.whyItMatters && (
              <p className="mt-2 text-sm text-muted">
                <span className="font-medium text-fg">Why it matters: </span>
                {story.whyItMatters}
              </p>
            )}
          </div>

          <div className="flex items-start gap-6">
            <div className="flex gap-4">
              <ScoreRing value={story.trendScore} label="Trend" tone="accent" />
              <ScoreRing value={story.qualityScore} label="Quality" tone="info" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Why this is trending</h3>
              <ul className="mt-1.5 space-y-1 text-sm">
                {story.trendReasons.slice(0, 6).map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <button className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:text-fg" onClick={() => setShowSources((v) => !v)}>
              <Link2 size={13} /> Sources ({story.sourceCount}) <ChevronDown size={13} className={`transition ${showSources ? "rotate-180" : ""}`} />
            </button>
            <div className="mt-2">
              <SourceList sources={story.sources} limit={showSources ? undefined : 4} />
            </div>
            {story.factCheck && (
              <p className="mt-2 text-xs text-muted">
                Fact-check: {story.factCheck.confirmed.length} confirmed claim{story.factCheck.confirmed.length === 1 ? "" : "s"}
                {story.factCheck.unverified.length ? `, ${story.factCheck.unverified.length} unverified` : ""}
                {story.factCheck.conflicting.length ? `, ${story.factCheck.conflicting.length} conflicting` : ""}.{" "}
                <Link href={`/story/${story.id}`} className="underline">
                  View details
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-2/40 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Threads post</h3>
            <ThreadsEditor storyId={story.id} post={story.post} historyId={`h-${story.id}`} onChange={(post) => setStory((s) => ({ ...s, post }))} />
          </div>
          <div className="rounded-xl border border-border bg-surface-2/40 p-4">
            <VisualsPanel storyId={story.id} visuals={story.visuals} onChange={(visuals) => setStory((s) => ({ ...s, visuals }))} />
          </div>
        </div>
      </div>
    </article>
  );
}
