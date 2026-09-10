import Link from "next/link";
import { notFound } from "next/navigation";
import { getStories, getStory } from "@/lib/store";
import { CategoryChip, CredibilityChip, FreshnessChip } from "@/components/Badges";
import { ScoreBar, ScoreRing } from "@/components/ScoreRing";
import { SourceList } from "@/components/SourceList";
import { StoryEditorSection } from "@/components/StoryEditorSection";
import { StoryRow } from "@/components/StoryRow";
import { timeAgo } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, HelpCircle, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = getStory(id);
  if (!story) notFound();
  const all = getStories(story.runId);
  const related = story.relatedStoryIds.map((r) => all.find((s) => s.id === r)).filter(Boolean);
  const fc = story.factCheck;

  return (
    <div className="space-y-6">
      <Link href="/discover" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> Discover
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-1.5">
          {story.rank && <span className="chip bg-accent-soft text-accent">#{story.rank} pick</span>}
          <CategoryChip category={story.category} />
          <FreshnessChip label={story.freshness.label} hoursOld={story.freshness.hoursOld} />
          <CredibilityChip credibility={story.credibility} title={story.credibilityLabel} />
          {story.tags.map((t) => (
            <span key={t} className="chip border-border text-muted">
              {t}
            </span>
          ))}
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">{story.headline}</h1>
        {story.selectionNote && <p className="mt-2 text-sm italic text-muted">{story.selectionNote}</p>}
        {story.repeat && story.repeat.verdict !== "new" && (
          <p className="mt-1 text-sm text-warn">
            {story.repeat.verdict === "same-story" ? "Already covered" : "New development on a covered story"}: {story.repeat.historyHeadline} {story.repeat.note ? `· ${story.repeat.note}` : ""}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="card p-5 space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">What happened</h2>
              <p className="mt-1 leading-relaxed">{story.whatHappened}</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Why it matters</h2>
              <p className="mt-1 leading-relaxed">{story.whyItMatters}</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Why it is trending</h2>
              <ul className="mt-1 space-y-1 text-sm">
                {story.trendReasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Fact check</h2>
            {fc ? (
              <div className="mt-2 space-y-3 text-sm">
                <p>
                  <CredibilityChip credibility={fc.status} /> <span className="ml-1 text-muted">{fc.statusReason}</span>
                </p>
                {fc.confirmed.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1 font-medium text-ok">
                      <CheckCircle2 size={14} /> Confirmed ({fc.confirmed.length})
                    </h3>
                    <ul className="mt-1 space-y-1">
                      {fc.confirmed.map((c, i) => (
                        <li key={i}>
                          {c.claim}{" "}
                          <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-muted underline">
                            {c.sourceName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {fc.unverified.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1 font-medium text-warn">
                      <HelpCircle size={14} /> Unverified ({fc.unverified.length})
                    </h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                      {fc.unverified.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {fc.conflicting.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1 font-medium text-bad">
                      <AlertTriangle size={14} /> Conflicting ({fc.conflicting.length})
                    </h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                      {fc.conflicting.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {fc.factSheet.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-muted">Verified fact sheet used for writing ({fc.factSheet.length})</summary>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {fc.factSheet.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <p className="text-xs text-muted">
                  Checked {timeAgo(fc.checkedAt)} against {fc.checkedUrls.length} page{fc.checkedUrls.length === 1 ? "" : "s"}.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Not fact-checked yet. Only top candidates are verified automatically; generating a post for this story will verify it first.
              </p>
            )}
          </section>

          <StoryEditorSection story={story} />
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <div className="flex justify-around">
              <ScoreRing value={story.trendScore} label="Trend" size={72} />
              <ScoreRing value={story.qualityScore} label="Quality" size={72} tone="info" />
              <ScoreRing value={story.overallScore} label="Overall" size={72} tone="ok" />
            </div>
            <div className="mt-4 space-y-1.5">
              <ScoreBar label="Coverage" value={story.signals.coverage} max={30} />
              <ScoreBar label="Discussion" value={story.signals.discussion} max={25} />
              <ScoreBar label="Developer" value={story.signals.developer} max={15} />
              <ScoreBar label="Official" value={story.signals.official} max={10} />
              <ScoreBar label="Freshness" value={story.signals.freshness} max={15} />
              <ScoreBar label="Video" value={story.signals.video} max={5} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>Importance <b className="text-fg">{story.assessment.importance}/10</b></div>
              <div>Novelty <b className="text-fg">{story.assessment.novelty}/10</b></div>
              <div>Discussability <b className="text-fg">{story.assessment.discussability}/10</b></div>
              <div>Dev relevance <b className="text-fg">{story.assessment.devRelevance}/10</b></div>
              {story.assessment.viralButShallow && <div className="col-span-2 text-warn">Flagged: viral but shallow</div>}
              {story.assessment.repostOfOldNews && <div className="col-span-2 text-warn">Flagged: repost of old news</div>}
            </div>
            <p className="mt-3 text-xs text-muted">{story.assessment.rationale}</p>
          </section>

          <section className="card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Sources · {story.sourceCount} ({story.independentSourceCount} independent outlets)
            </h2>
            <div className="mt-2">
              <SourceList sources={story.sources} />
            </div>
            <p className="mt-3 text-xs text-muted">
              First seen {timeAgo(story.freshness.earliestAt)} · latest mention {timeAgo(story.freshness.latestAt)}
            </p>
          </section>
        </aside>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Related stories</h2>
          <div className="grid gap-3">
            {related.map((r) => (
              <StoryRow key={r!.id} story={r!} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
