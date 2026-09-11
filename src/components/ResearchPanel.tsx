"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Run } from "@/lib/types";
import { Search, Loader2, AlertCircle, ChevronDown, ListFilter, ShieldCheck, PenLine, Check } from "lucide-react";

const STAGES = [
  { label: "Collect", detail: "Scan top sources", Icon: Search },
  { label: "Filter", detail: "Find what matters", Icon: ListFilter },
  { label: "Verify", detail: "Check the facts", Icon: ShieldCheck },
  { label: "Write", detail: "Draft for Threads", Icon: PenLine },
];

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
    const data = (await res.json()) as { run: Run | null };
    setRun(data.run);
    return data.run;
  }, []);

  useEffect(() => {
    if (run?.status !== "running") return;
    const timer = setInterval(async () => {
      const nextRun = await poll();
      if (nextRun && nextRun.status !== "running") {
        clearInterval(timer);
        wasRunning.current = false;
        router.refresh();
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [run?.status, poll, router]);

  async function start() {
    setStarting(true);
    setErr(null);
    try {
      const res = await fetch("/api/research", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start");
      wasRunning.current = true;
      setRun(data.run);
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const running = run?.status === "running";
  const stats = run?.stats;
  const activeIndex = running ? Math.min(3, Math.floor((run?.progress.pct ?? 0) / 25)) : run?.status === "done" ? 4 : 0;

  return (
    <section className="border-y border-border py-5">
      <div className="grid items-center gap-6 xl:grid-cols-[minmax(220px,0.78fr)_minmax(600px,1.9fr)]">
        <div>
          <button className="btn btn-accent w-full justify-center sm:w-auto" onClick={start} disabled={running || starting || !hasApiKey}>
            {running || starting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {running ? "Researching…" : run ? "Run fresh research" : "Find today's stories"}
          </button>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            {running ? <span className="pulse-soft">{run?.progress.message}</span> : run ? <>Updated {fmt(run.finishedAt ?? run.startedAt)}{provider ? ` · ${provider}` : ""}</> : "Scan, score, verify, and write in one run."}
          </p>
        </div>

        <ol aria-label="Research workflow" className="grid grid-cols-4 gap-1">
          {STAGES.map(({ label, detail, Icon }, index) => {
            const complete = index < activeIndex;
            const active = running && index === activeIndex;
            return (
              <li key={label} className="relative flex min-w-0 flex-col items-center text-center">
                {index > 0 ? <span className={`absolute right-1/2 top-5 h-px w-full ${complete || active ? "bg-accent/50" : "bg-border"}`} /> : null}
                <span className={`relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${active ? "border-accent bg-accent text-white" : complete ? "border-fg bg-fg text-white" : "border-border bg-bg text-muted"}`}>
                  {complete ? <Check size={15} /> : <Icon size={15} />}
                </span>
                <span className="mt-2 text-xs font-semibold">{label}</span>
                <span className="mt-0.5 hidden text-[10px] leading-tight text-muted sm:block">{detail}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {running ? (
        <div className="mt-5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${run?.progress.pct ?? 0}%` }} /></div>
          <ol className="mt-3 max-h-28 space-y-1 overflow-auto font-mono text-[11px] text-muted">{run?.progress.log.slice(-5).map((line, index) => <li key={index}>{line}</li>)}</ol>
        </div>
      ) : null}

      {!hasApiKey ? <p className="mt-4 flex items-start gap-2 rounded-[9px] bg-warn-soft px-3 py-2.5 text-sm text-warn"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>No model configured. Add <code className="font-mono">GEMINI_API_KEY</code> to <code className="font-mono">.env.local</code> and restart the app.</span></p> : null}
      {run?.status === "error" ? <p className="mt-4 flex items-start gap-2 rounded-[9px] bg-bad-soft px-3 py-2.5 text-sm text-bad"><AlertCircle size={16} className="mt-0.5 shrink-0" />{run.error}</p> : null}
      {err ? <p className="mt-4 rounded-[9px] bg-bad-soft px-3 py-2.5 text-sm text-bad">{err}</p> : null}

      {stats && stats.sourceReports.length > 0 && !running ? (
        <div className="mt-4 border-t border-border pt-3">
          <button className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg" onClick={() => setShowSources((value) => !value)} aria-expanded={showSources}>
            <ChevronDown size={13} className={`transition ${showSources ? "rotate-180" : ""}`} /> Source coverage · {stats.sourcesOk}/{stats.sourcesQueried} responded · {stats.itemsCollected} items · {stats.clusters} stories
          </button>
          {showSources ? <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs sm:grid-cols-3 lg:grid-cols-4">{stats.sourceReports.map((report) => <div key={report.source} className={`flex justify-between gap-2 ${report.ok ? "" : "text-muted"}`} title={report.note}><span className="truncate">{report.ok ? "" : "× "}{report.source}</span><span className="tabular-nums text-muted">{report.ok ? report.count : "—"}</span></div>)}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
