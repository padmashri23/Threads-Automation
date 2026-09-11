import Link from "next/link";
import { getActiveRun } from "@/lib/pipeline/run";
import { getLatestRun, getStories } from "@/lib/store";
import { hasApiKey, providerLabel } from "@/lib/ai/client";
import { ResearchPanel } from "@/components/ResearchPanel";
import { TopStoryCard } from "@/components/TopStoryCard";
import { StoryRow } from "@/components/StoryRow";
import { ArrowUpRight, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  const run = getActiveRun() ?? getLatestRun();
  const stories = run ? getStories(run.id) : [];
  const picks = run ? run.topPicks.map((id) => stories.find((story) => story.id === id)).filter(Boolean) : [];
  const runnerUps = run ? run.runnerUps.map((id) => stories.find((story) => story.id === id)).filter(Boolean) : [];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-9">
      <header className="page-heading pt-1">
        <p className="mb-4 text-sm font-medium text-muted">{today}</p>
        <h1 className="page-title">Today&apos;s briefing</h1>
        <p className="page-description">The stories worth talking about, verified and ready to shape.</p>
      </header>

      <ResearchPanel initialRun={run} hasApiKey={hasApiKey()} provider={providerLabel()} />

      {run?.status === "done" && run.editorNote ? (
        <div className="flex items-start gap-3 border-l-2 border-accent py-1 pl-4 text-sm leading-relaxed text-muted">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
          <p><span className="font-semibold text-fg">Editor&apos;s note.</span> {run.editorNote}</p>
        </div>
      ) : null}

      {picks.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <h2 className="section-heading">Top stories</h2>
            <p className="hidden text-xs text-muted sm:block">Fresh stories, deeper context, better posts.</p>
          </div>
          <div className="space-y-6">
            {picks.map((story) => <TopStoryCard key={story!.id} story={story!} />)}
          </div>
        </section>
      ) : null}

      {run?.status === "done" && picks.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Nothing worth posting today</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">The research ran, but no story cleared the quality, momentum, and verification bar. That is a useful answer, not a failure.</p>
          <Link href="/discover" className="btn mt-5">See everything considered <ArrowUpRight size={14} /></Link>
        </div>
      ) : null}

      {!run ? (
        <div className="border-y border-border py-9 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Your editorial desk is ready</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">Start a research run to scan trusted AI and technology sources, verify the strongest stories, and prepare two grounded Threads drafts.</p>
        </div>
      ) : null}

      {runnerUps.length > 0 ? (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-4">
            <h2 className="section-heading">Also considered</h2>
            <Link href="/discover" className="inline-flex items-center gap-1 text-sm font-semibold text-info hover:underline">Explore all <ArrowUpRight size={14} /></Link>
          </div>
          <div className="card divide-y divide-border overflow-hidden">
            {runnerUps.map((story) => <StoryRow key={story!.id} story={story!} showNote variant="row" />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
