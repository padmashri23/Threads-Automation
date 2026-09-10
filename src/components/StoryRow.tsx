import Link from "next/link";
import type { Story } from "@/lib/types";
import { CategoryChip, CredibilityChip, FreshnessChip } from "./Badges";
import { timeAgo } from "@/lib/utils";

export function StoryRow({ story, showNote }: { story: Story; showNote?: boolean }) {
  return (
    <Link href={`/story/${story.id}`} className="card block p-4 transition hover:border-accent/50">
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col items-center rounded-lg bg-surface-2 px-2.5 py-1.5">
          <span className="text-lg font-bold tabular-nums leading-none text-accent">{Math.round(story.trendScore)}</span>
          <span className="text-[10px] uppercase text-muted">trend</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {story.rank && <span className="chip bg-accent-soft text-accent">#{story.rank} pick</span>}
            <CategoryChip category={story.category} />
            <FreshnessChip label={story.freshness.label} hoursOld={story.freshness.hoursOld} />
            <CredibilityChip credibility={story.credibility} />
          </div>
          <h3 className="mt-1.5 font-semibold leading-snug">{story.headline}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{story.whyItMatters || story.whatHappened}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>Quality {Math.round(story.qualityScore)}</span>
            <span>{story.sourceCount} source{story.sourceCount === 1 ? "" : "s"}</span>
            <span>{story.independentSourceCount} independent outlet{story.independentSourceCount === 1 ? "" : "s"}</span>
            <span>{timeAgo(story.freshness.earliestAt)}</span>
            {story.trendReasons[0] && <span className="hidden sm:inline">· {story.trendReasons[0]}</span>}
          </div>
          {showNote && story.selectionNote && <p className="mt-1.5 text-xs italic text-muted">{story.selectionNote}</p>}
        </div>
      </div>
    </Link>
  );
}
