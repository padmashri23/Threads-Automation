import { getActiveRun } from "@/lib/pipeline/run";
import { getLatestRun, getStories } from "@/lib/store";
import { DiscoverList } from "@/components/DiscoverList";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  const run = getActiveRun() ?? getLatestRun();
  const stories = run ? getStories(run.id) : [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Discover</h1>
        <p className="mt-1 text-muted">
          Every distinct story identified in the last research run, with its trend score and why it is interesting.
          {run?.stats ? ` ${run.stats.itemsCollected} raw items became ${stories.length} stories.` : ""}
        </p>
      </div>
      {stories.length ? (
        <DiscoverList stories={stories} />
      ) : (
        <div className="card p-8 text-center text-sm text-muted">
          No stories yet.{" "}
          <Link href="/" className="underline">
            Run research from the Today page
          </Link>
          .
        </div>
      )}
    </div>
  );
}
