"use client";

import { useState } from "react";
import Link from "next/link";
import type { HistoryEntry, HistoryStatus } from "@/lib/types";
import { CategoryChip, StatusChip } from "./Badges";
import { Copy, Check, ChevronDown } from "lucide-react";

export function HistoryTable({ entries: initial }: { entries: HistoryEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function setStatus(id: string, status: HistoryStatus) {
    const res = await fetch("/api/history", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (res.ok) setEntries((es) => es.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  async function copy(e: HistoryEntry) {
    await navigator.clipboard.writeText(e.post);
    setCopied(e.id);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!entries.length) return <div className="card p-8 text-center text-sm text-muted">No history yet. Picks are recorded here after each research run.</div>;

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Story</th>
            <th className="hidden px-4 py-2 font-medium md:table-cell">Category</th>
            <th className="hidden px-4 py-2 font-medium sm:table-cell">Trend</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <HistoryRowGroup key={e.id} e={e} open={open === e.id} toggle={() => setOpen(open === e.id ? null : e.id)} setStatus={setStatus} copy={copy} copied={copied === e.id} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryRowGroup({
  e,
  open,
  toggle,
  setStatus,
  copy,
  copied,
}: {
  e: HistoryEntry;
  open: boolean;
  toggle: () => void;
  setStatus: (id: string, s: HistoryStatus) => void;
  copy: (e: HistoryEntry) => void;
  copied: boolean;
}) {
  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="whitespace-nowrap px-4 py-3 text-muted">{new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
        <td className="px-4 py-3">
          <Link href={`/story/${e.storyId}`} className="font-medium hover:underline">
            {e.headline}
          </Link>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{e.summary}</p>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <CategoryChip category={e.category} />
        </td>
        <td className="hidden px-4 py-3 tabular-nums sm:table-cell">
          {Math.round(e.trendScore)} <span className="text-xs text-muted">/ q{Math.round(e.qualityScore)}</span>
        </td>
        <td className="px-4 py-3">
          <select className="select !w-auto !py-1 !text-xs" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value as HistoryStatus)}>
            <option value="suggested">Suggested</option>
            <option value="published">Published</option>
            <option value="skipped">Skipped</option>
          </select>
        </td>
        <td className="px-4 py-3 text-right">
          <button className="btn btn-sm" onClick={toggle} disabled={!e.post}>
            <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} /> Post
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-surface-2/40">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <p className="whitespace-pre-wrap flex-1 text-[15px] leading-relaxed">{e.post || "(no post)"}</p>
              <div className="flex flex-col gap-1">
                <button className="btn btn-sm" onClick={() => copy(e)}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                </button>
                <StatusChip status={e.status} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
