"use client";

import { useState } from "react";
import type { Slide, Visuals } from "@/lib/types";
import { Images, Loader2, Download, RefreshCw, Pencil, Check, X } from "lucide-react";

type Mode = "auto" | "single" | "carousel";

export function VisualsPanel({ storyId, visuals, onChange }: { storyId: string; visuals?: Visuals; onChange?: (v: Visuals) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [instruction, setInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Slide[]>(visuals?.slides ?? []);

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/visuals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, instruction: instruction || undefined }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      onChange?.(j.story.visuals);
      setDraft(j.story.visuals.slides);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function rerender() {
    setBusy("render");
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/visuals`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slides: draft }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      onChange?.(j.story.visuals);
      setDraft(j.story.visuals.slides);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const slides = visuals?.slides ?? [];
  const v = visuals?.version ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Images size={13} /> Image cards
          {visuals && <span className="normal-case font-normal">· {visuals.mode === "none" ? "none suggested" : visuals.mode === "single" ? "single card" : `carousel, ${slides.length} cards`}</span>}
        </h3>
        <span className="flex-1" />
        <select className="select !w-auto !py-1 !text-xs" value={mode} onChange={(e) => setMode(e.target.value as Mode)} disabled={Boolean(busy)}>
          <option value="auto">Let the editor decide</option>
          <option value="single">Single card</option>
          <option value="carousel">Carousel</option>
        </select>
        <button className="btn btn-sm" onClick={generate} disabled={Boolean(busy)}>
          {busy === "generate" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {visuals ? "Regenerate" : "Create cards"}
        </button>
        {slides.length > 0 && (
          <button className="btn btn-sm" onClick={() => { setEditing((e) => !e); setDraft(slides); }} disabled={Boolean(busy)}>
            {editing ? <X size={13} /> : <Pencil size={13} />} {editing ? "Cancel" : "Edit text"}
          </button>
        )}
      </div>

      {visuals?.reason && <p className="text-xs text-muted">{visuals.reason}</p>}

      {busy === "generate" && <p className="text-xs text-muted pulse-soft">Writing card copy from the verified facts and rendering…</p>}

      {slides.length > 0 && !editing && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slides.map((s, i) => (
            <figure key={s.file} className="group relative overflow-hidden rounded-lg border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/visuals/${storyId}/${s.file}?v=${v}`} alt={`Card ${i + 1}: ${s.title}`} className="block w-full" />
              <a
                href={`/api/visuals/${storyId}/${s.file}?download=1&v=${v}`}
                className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-fg/85 px-2 py-1 text-[11px] font-medium text-bg opacity-0 transition group-hover:opacity-100"
                title="Download PNG"
              >
                <Download size={11} /> PNG
              </a>
              <figcaption className="px-2 py-1 text-[11px] text-muted">
                {i + 1}. {s.kind}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {editing && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          {draft.map((s, i) => (
            <div key={i} className="grid gap-1.5 sm:grid-cols-[90px_1fr]">
              <div className="text-xs text-muted pt-2">
                {i + 1}. {s.kind}
              </div>
              <div className="space-y-1.5">
                <input className="input !py-1.5 !text-sm" placeholder="Kicker (small label)" value={s.kicker ?? ""} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, kicker: e.target.value } : x)))} />
                <input className="input !py-1.5 !text-sm font-medium" placeholder="Title" value={s.title} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                {s.kind === "stat" && <input className="input !py-1.5 !text-sm" placeholder="Big figure" value={s.stat ?? ""} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, stat: e.target.value } : x)))} />}
                <textarea className="textarea !min-h-[56px] !py-1.5 !text-sm" placeholder="Body" value={s.body ?? ""} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                <input className="input !py-1.5 !text-xs" placeholder="Source line" value={s.source ?? ""} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))} />
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button className="btn btn-sm btn-primary" onClick={rerender} disabled={Boolean(busy)}>
              {busy === "render" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Re-render cards
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex gap-2">
          <input className="input !py-1.5 !text-sm" placeholder="Optional instruction, e.g. 'make the stat card about pricing', 'add a card on developer impact'" value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()} disabled={Boolean(busy)} />
        </div>
      )}

      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {slides.length > 0 && <p className="text-[11px] text-muted">Hover a card to download it. In Threads, attach the PNGs in order to post them as a carousel.</p>}
    </div>
  );
}
