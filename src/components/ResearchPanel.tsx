"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Run } from "@/lib/types";
import { Radar, Loader2, AlertCircle, ChevronDown } from "lucide-react";

function fmt(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

export function ResearchPanel({ initialRun, hasApiKey, provider }: { initialRun: Run | null; hasApiKey: boolean; provider?: string }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(initialRun);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const wasRunning = useRef(initialRun?.status === "running");

  const poll = useCallback(async () => {
    const res = await fetch("/api/research", { cache: "no-store" });
    const j = (await res.json()) as { run: Run | null };
    setRun(j.run);
    return j.run;
  }, []);

  useEffect(() => {
    if (run?.status !== "running") return;
    const t = setInterval(async () => {
      const r = await poll();
      if (r && r.status !== "running") {
        clearInterval(t);
        wasRunning.current = false;
        router.refresh();
      }
    }, 1500);
    return () => clearInterval(t);
  }, [run?.status, poll, router]);

  async function start() {
    setStarting(true);
    setErr(null);
    try {
      const res = await fetch("/api/research", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not start");
      wasRunning.current = true;
      setRun(j.run);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const running = run?.status === "running";
  const s = run?.stats;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-accent" onClick={start} disabled={running || starting || !hasApiKey}>
          {running || starting ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
          {running ? "Researching…" : run ? "Run fresh research" : "Find today's stories"}
        </button>
        <div className="text-sm text-muted">
          {running ? (
            <span className="pulse-soft">{run?.progress.message}</span>
          ) : run ? (
            <>
              Last research {fmt(run.finishedAt ?? run.startedAt)}
              {s ? ` · ${s.itemsCollected} items from ${s.sourcesOk} sources → ${s.clusters} stories → ${run.topPicks.length} pick${run.topPicks.length === 1 ? "" : "s"}` : ""}
            </>
          ) : (
            "No research yet. Runs take a few minutes: it scans ~50 sources, clusters, scores, verifies and writes."
          )}
          {hasApiKey && provider && !running && <span className="ml-1 text-xs">· model: {provider}</span>}
        </div>
      </div>

      {!hasApiKey && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            No model configured. Get a free key from Google AI Studio, put it in <code className="font-mono">.env.local</code> as <code className="font-mono">GEMINI_API_KEY</code> (see <code className="font-mono">.env.example</code>), and restart the app.
          </span>
        </p>
      )}

      {running && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${run?.progress.pct ?? 0}%` }} />
          </div>
          <ol className="mt-2 max-h-28 space-y-0.5 overflow-auto font-mono text-[11px] text-muted">
            {run?.progress.log.slice(-6).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </div>
      )}

      {run?.status === "error" && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {run.error}
        </p>
      )}
      {err && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{err}</p>}

      {s && s.sourceReports.length > 0 && !running && (
        <div className="mt-3">
          <button className="flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={() => setShowSources((v) => !v)}>
            <ChevronDown size={13} className={showSources ? "rotate-180 transition" : "transition"} /> Source coverage ({s.sourcesOk}/{s.sourcesQueried} responded)
          </button>
          {showSources && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
              {s.sourceReports.map((r) => (
                <div key={r.source} className={`flex justify-between gap-2 ${r.ok ? "" : "text-muted"}`} title={r.note}>
                  <span className="truncate">
                    {r.ok ? "" : "✕ "}
                    {r.source}
                  </span>
                  <span className="tabular-nums text-muted">{r.ok ? r.count : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
