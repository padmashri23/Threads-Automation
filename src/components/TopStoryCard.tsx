"use client";

import { useState } from "react";
import Link from "next/link";
import type { Story } from "@/lib/types";
import { CategoryChip, CredibilityChip, FreshnessChip } from "./Badges";
import { SourceList } from "./SourceList";
import { ThreadsEditor } from "./ThreadsEditor";
import { VisualsPanel } from "./VisualsPanel";
import { ArrowUpRight, ChevronDown, Link2 } from "lucide-react";

export function TopStoryCard({ story: initial }: { story: Story }) {
  const [story, setStory] = useState(initial);
  const [showSources, setShowSources] = useState(false);
  const rank = story.rank ?? 1;

  return (
    <article className="card overflow-hidden">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex gap-4 sm:gap-6">
            <div className="hidden w-[70px] shrink-0 pt-0.5 text-[3.5rem] font-semibold leading-none tracking-[-0.08em] text-[#b8bbb5] sm:block">{String(rank).padStart(2, "0")}</div>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="eyebrow">{rank === 1 ? "Top story" : "Second story"}</span>
                <span className="h-px w-8 bg-accent" />
              </div>
              <h3 className="text-[1.65rem] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[2rem]">
                <Link href={`/story/${story.id}`} className="decoration-accent/50 underline-offset-4 hover:underline">{story.headline}</Link>
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <CategoryChip category={story.category} />
                <FreshnessChip label={story.freshness.label} hoursOld={story.freshness.hoursOld} />
                <CredibilityChip credibility={story.credibility} title={story.credibilityLabel} />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-5 text-[14px] leading-[1.65] sm:ml-[94px]">
            <p>{story.whatHappened}</p>
            {story.whyItMatters ? <div><h4 className="font-semibold">Why it matters</h4><p className="mt-0.5 text-muted">{story.whyItMatters}</p></div> : null}

            <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-[1fr_auto]">
              <div>
                <h4 className="font-semibold">Why this is trending</h4>
                <ol className="mt-2 space-y-1.5">
                  {story.trendReasons.slice(0, 4).map((reason, index) => <li key={index} className="flex gap-3 text-muted"><span className="w-4 shrink-0 text-right font-semibold tabular-nums text-accent">{index + 1}</span><span>{reason}</span></li>)}
                </ol>
              </div>
              <dl className="flex gap-2 sm:flex-col">
                <div className="min-w-[84px] rounded-[9px] bg-surface-2 px-3 py-2"><dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Trend</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{Math.round(story.trendScore)}</dd></div>
                <div className="min-w-[84px] rounded-[9px] bg-info-soft px-3 py-2"><dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-info">Quality</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{Math.round(story.qualityScore)}</dd></div>
              </dl>
            </div>

            <div>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-fg hover:text-accent" onClick={() => setShowSources((value) => !value)} aria-expanded={showSources}>
                <ChevronDown size={14} className={`transition ${showSources ? "rotate-180" : ""}`} /><Link2 size={13} /> Sources ({story.sourceCount})
              </button>
              {showSources ? <div className="mt-3"><SourceList sources={story.sources} /></div> : <p className="mt-1.5 line-clamp-1 text-xs text-muted">{story.sources.slice(0, 3).map((source) => source.name).join(", ")}{story.sourceCount > 3 ? ` +${story.sourceCount - 3} more` : ""}</p>}
              {story.factCheck ? <Link href={`/story/${story.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline">View verification details <ArrowUpRight size={12} /></Link> : null}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-[#fbfbfa] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
          <section>
            <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold">Threads draft</h4>{story.post ? <span className="text-[11px] text-muted">v{story.post.version}</span> : null}</div>
            <ThreadsEditor storyId={story.id} post={story.post} historyId={`h-${story.id}`} compact onChange={(post) => setStory((current) => ({ ...current, post }))} />
          </section>
          <section className="mt-7 border-t border-border pt-6">
            <VisualsPanel storyId={story.id} visuals={story.visuals} onChange={(visuals) => setStory((current) => ({ ...current, visuals }))} />
          </section>
        </div>
      </div>
    </article>
  );
}
