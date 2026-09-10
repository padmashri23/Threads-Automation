"use client";

import { useState } from "react";
import type { StyleSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { Save, RotateCcw, Check } from "lucide-react";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function listToText(a: string[]) {
  return a.join("\n");
}
function textToList(s: string) {
  return s
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function SettingsForm({ initial }: { initial: StyleSettings }) {
  const [s, setS] = useState<StyleSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof StyleSettings>(k: K, v: StyleSettings[K]) {
    setS((x) => ({ ...x, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      if (!res.ok) throw new Error("Could not save");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-5 p-5">
        <h2 className="font-semibold">Voice</h2>
        <Field label="Tone">
          <input className="input" value={s.tone} onChange={(e) => set("tone", e.target.value)} />
        </Field>
        <Field label="Audience" hint="Who you are writing for. The editor uses this to decide what needs explaining.">
          <textarea className="textarea !min-h-[70px]" value={s.audience} onChange={(e) => set("audience", e.target.value)} />
        </Field>
        <Field label="Writing style">
          <textarea className="textarea !min-h-[110px]" value={s.writingStyle} onChange={(e) => set("writingStyle", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Technical depth">
            <select className="select" value={s.technicalDepth} onChange={(e) => set("technicalDepth", e.target.value as StyleSettings["technicalDepth"])}>
              <option value="light">Light: explain everything</option>
              <option value="balanced">Balanced</option>
              <option value="deep">Deep: developer detail</option>
            </select>
          </Field>
          <Field label="Post length">
            <select className="select" value={s.postLength} onChange={(e) => set("postLength", e.target.value as StyleSettings["postLength"])}>
              <option value="short">Short (≤ 280 chars)</option>
              <option value="standard">Standard (300–500 chars)</option>
              <option value="thread">Thread (2–4 posts)</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.useEmoji} onChange={(e) => set("useEmoji", e.target.checked)} /> Allow one emoji when it helps
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.useHashtags} onChange={(e) => set("useHashtags", e.target.checked)} /> Allow up to two hashtags
          </label>
        </div>
      </div>

      <div className="card space-y-5 p-5">
        <h2 className="font-semibold">Topics and phrases</h2>
        <Field label="Topics you prefer" hint="One per line. Nudges selection when stories are otherwise close.">
          <textarea className="textarea !min-h-[90px]" value={listToText(s.preferredTopics)} onChange={(e) => set("preferredTopics", textToList(e.target.value))} />
        </Field>
        <Field label="Topics you don't want" hint="One per line.">
          <textarea className="textarea !min-h-[70px]" value={listToText(s.avoidTopics)} onChange={(e) => set("avoidTopics", textToList(e.target.value))} />
        </Field>
        <Field label="Words and phrases you dislike" hint="One per line. The writer never uses these.">
          <textarea className="textarea !min-h-[110px]" value={listToText(s.bannedPhrases)} onChange={(e) => set("bannedPhrases", textToList(e.target.value))} />
        </Field>
        <Field label="Research window (hours)" hint="How far back to look for stories. 48 is a good default; momentum scoring still favours what is moving now.">
          <input type="number" className="input max-w-[140px]" min={12} max={96} value={s.lookbackHours} onChange={(e) => set("lookbackHours", Number(e.target.value))} />
        </Field>
      </div>

      <div className="card space-y-5 p-5 lg:col-span-2">
        <h2 className="font-semibold">Image cards</h2>
        <p className="text-sm text-muted">
          Each story can come with a single card or a carousel of image cards rendered from the verified facts (no image model, no cost). You download the PNGs and attach them in Threads.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Brand handle" hint="Shown in the footer of every card.">
            <input className="input" value={s.brandHandle} onChange={(e) => set("brandHandle", e.target.value)} placeholder="@yourhandle" />
          </Field>
          <Field label="Card style">
            <select className="select" value={s.visualTheme} onChange={(e) => set("visualTheme", e.target.value as StyleSettings["visualTheme"])}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Field>
          <Field label="When to create cards">
            <select className="select" value={s.visualsMode} onChange={(e) => set("visualsMode", e.target.value as StyleSettings["visualsMode"])}>
              <option value="auto">Let the editor decide per story</option>
              <option value="always">Always, for both picks</option>
              <option value="never">Never (create them on demand)</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saved ? <Check size={15} /> : <Save size={15} />} {saved ? "Saved" : saving ? "Saving…" : "Save style"}
        </button>
        <button
          className="btn"
          onClick={() => {
            setS(DEFAULT_SETTINGS);
            setSaved(false);
          }}
        >
          <RotateCcw size={15} /> Reset to defaults
        </button>
        {error && <span className="text-sm text-bad">{error}</span>}
      </div>
    </div>
  );
}
