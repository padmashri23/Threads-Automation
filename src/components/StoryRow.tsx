import Link from "next/link";
import type { Story } from "@/lib/types";
import { CategoryChip, CredibilityChip, FreshnessChip } from "./Badges";
import { timeAgo } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export function StoryRow({ story, showNote, variant = "card" }: { story: Story; showNote?: boolean; variant?: "card" | "row" }) {
  return (
    <Link href={`/story/${story.id}`} className={`group block bg-surface px-4 py-4 transition hover:bg-surface-2/70 sm:px-5 ${variant === "card" ? "rounded-[12px] border border-border shadow-[var(--shadow-sm)]" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="w-10 shrink-0 pt-0.5 text-center text-2xl font-semibold leading-none tracking-[-0.06em] text-[#a8aca6]">{story.rank ? String(story.rank).padStart(2, "0") : Math.round(story.trendScore)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><CategoryChip category={story.category} /><FreshnessChip label={story.freshness.label} hoursOld={story.freshness.hoursOld} /><CredibilityChip credibility={story.credibility} /></div>
          <h3 className="mt-2 font-semibold leading-snug tracking-[-0.015em] group-hover:text-accent">{story.headline}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{story.whyItMatters || story.whatHappened}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted"><span>Trend {Math.round(story.trendScore)}</span><span>Quality {Math.round(story.qualityScore)}</span><span>{story.sourceCount} sources</span><span>{timeAgo(story.freshness.earliestAt)}</span></div>
          {showNote && story.selectionNote ? <p className="mt-1.5 text-xs italic text-muted">{story.selectionNote}</p> : null}
        </div>
        <ArrowUpRight size={16} className="mt-1 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
    </Link>
  );
}
