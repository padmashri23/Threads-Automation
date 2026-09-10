import Link from "next/link";
import { getActiveRun } from "@/lib/pipeline/run";
import { getLatestRun, getStories } from "@/lib/store";
import { hasApiKey, providerLabel } from "@/lib/ai/client";
import { ResearchPanel } from "@/components/ResearchPanel";
import { TopStoryCard } from "@/components/TopStoryCard";
import { StoryRow } from "@/components/StoryRow";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  const run = getActiveRun() ?? getLatestRun();
  const stories = run ? getStories(run.id) : [];
  const picks = run ? run.topPicks.map((id) => stories.find((s) => s.id === id)).filter(Boolean) : [];
  const runnerUps = run ? run.runnerUps.map((id) => stories.find((s) => s.id === id)).filter(Boolean) : [];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{today}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Today&apos;s Top AI &amp; Technology Trends</h1>
        <p className="mt-2 max-w-2xl text-muted">
          The two stories worth talking about right now, researched across the AI ecosystem, verified against original sources, and written for Threads.
        </p>
      </div>

      <ResearchPanel initialRun={run} hasApiKey={hasApiKey()} provider={providerLabel()} />

      {run?.status === "done" && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <span className="font-medium">Editor&apos;s note: </span>
            {run.editorNote}
          </span>
        </p>
      )}

      {picks.length > 0 && (
        <div className="space-y-6">
          {picks.map((s) => (
            <TopStoryCard key={s!.id} story={s!} />
          ))}
        </div>
      )}

      {run?.status === "done" && picks.length === 0 && (
        <div className="card p-8 text-center">
          <h2 className="text-lg font-semibold">Nothing worth posting today</h2>
          <p className="mt-1 text-sm text-muted">
            The research ran, but no story cleared the quality, momentum and verification bar. That is a real answer, not a failure.{" "}
            <Link href="/discover" className="underline">
              See everything that was considered
            </Link>
            .
          </p>
        </div>
      )}

      {!run && (
        <div className="card p-8 text-center">
          <h2 className="text-lg font-semibold">Ask your editor</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
            Click <span className="font-medium text-fg">Find today&apos;s stories</span>. The app scans Hacker News, Reddit, GitHub, Hugging Face, arXiv, YouTube, the major tech
            publications, the AI labs&apos; own announcements and a wide news net, merges duplicate coverage, scores trend momentum and editorial
            quality, verifies the top candidates, and writes two Threads posts.
          </p>
        </div>
      )}

      {runnerUps.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Also considered</h2>
            <Link href="/discover" className="text-sm text-muted hover:text-fg hover:underline">
              All {stories.length} stories →
            </Link>
          </div>
          <div className="grid gap-3">
            {runnerUps.map((s) => (
              <StoryRow key={s!.id} story={s!} showNote />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
