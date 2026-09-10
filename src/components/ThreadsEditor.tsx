"use client";

import { useMemo, useState } from "react";
import type { GeneratedPost, RefineAction } from "@/lib/types";
import { Copy, Check, RefreshCw, Scissors, MessageCircle, Cpu, Sparkles, Wand2, Save, Send, X, UserRound } from "lucide-react";

const LIMIT = 500;

export function ThreadsEditor({
  storyId,
  post,
  onChange,
  historyId,
  compact,
}: {
  storyId: string;
  post?: GeneratedPost;
  onChange?: (p: GeneratedPost) => void;
  historyId?: string;
  compact?: boolean;
}) {
  const [text, setText] = useState(post?.text ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [published, setPublished] = useState(false);

  // Reset the draft when the parent supplies a new post version (e.g. after a research run).
  const [seenVersion, setSeenVersion] = useState(post?.version);
  if (post?.version !== seenVersion) {
    setSeenVersion(post?.version);
    setText(post?.text ?? "");
    setDirty(false);
  }

  const parts = useMemo(() => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean), [text]);
  const overLimit = parts.some((p) => p.length > LIMIT);

  async function refine(action: RefineAction) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text, instruction: action === "custom" ? instruction : undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      onChange?.(j.story.post);
      setText(j.story.post.text);
      setDirty(false);
      setCustomOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      onChange?.(j.story.post);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function markPublished() {
    setBusy("publish");
    try {
      if (dirty) await save();
      await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyId ? { id: historyId, status: "published" } : { storyId, status: "published" }),
      });
      setPublished(true);
    } finally {
      setBusy(null);
    }
  }

  const actions: Array<{ key: RefineAction; label: string; Icon: typeof RefreshCw }> = [
    { key: "regenerate", label: "Regenerate", Icon: RefreshCw },
    { key: "shorter", label: "Shorter", Icon: Scissors },
    { key: "conversational", label: "More conversational", Icon: MessageCircle },
    { key: "technical", label: "More technical", Icon: Cpu },
    { key: "hook", label: "Improve hook", Icon: Sparkles },
    { key: "humanize", label: "More human", Icon: UserRound },
  ];

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          className={`textarea font-sans text-[15px] ${compact ? "min-h-[140px]" : "min-h-[190px]"} ${busy ? "opacity-60" : ""}`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          placeholder={post ? "" : "No post yet. Click Regenerate to write one from the verified facts."}
          disabled={Boolean(busy)}
        />
        {busy && busy !== "save" && busy !== "publish" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-surface px-3 py-1 text-xs shadow pulse-soft">Rewriting from verified facts…</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {parts.length > 1 ? (
          parts.map((p, i) => (
            <span key={i} className={p.length > LIMIT ? "text-bad font-medium" : ""}>
              Part {i + 1}: {p.length}/{LIMIT}
            </span>
          ))
        ) : (
          <span className={text.length > LIMIT ? "text-bad font-medium" : ""}>
            {text.length}/{LIMIT} characters
          </span>
        )}
        {post?.version ? <span>· v{post.version}{post.lastAction ? ` (${post.lastAction})` : ""}</span> : null}
        {dirty && <span className="text-warn">· unsaved edits</span>}
        {overLimit && <span className="text-bad">· over the Threads limit</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map(({ key, label, Icon }) => (
          <button key={key} className="btn btn-sm" disabled={Boolean(busy)} onClick={() => refine(key)}>
            <Icon size={13} className={busy === key ? "animate-spin" : ""} /> {label}
          </button>
        ))}
        <button className="btn btn-sm" disabled={Boolean(busy)} onClick={() => setCustomOpen((v) => !v)}>
          <Wand2 size={13} /> Custom
        </button>
        <span className="flex-1" />
        {dirty && (
          <button className="btn btn-sm" disabled={Boolean(busy)} onClick={save}>
            <Save size={13} /> Save edit
          </button>
        )}
        <button className="btn btn-sm btn-primary" disabled={!text} onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
        <button className="btn btn-sm" disabled={!text || Boolean(busy) || published} onClick={markPublished} title="Record this as published so it won't be suggested again">
          <Send size={13} /> {published ? "Marked published" : "Mark published"}
        </button>
      </div>

      {customOpen && (
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="e.g. Lead with the developer angle, mention the open-source licence, end with a question"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && instruction && refine("custom")}
          />
          <button className="btn btn-accent" disabled={!instruction || Boolean(busy)} onClick={() => refine("custom")}>
            Apply
          </button>
          <button className="btn" onClick={() => setCustomOpen(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      {post?.factualBasis?.length ? (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none">Facts this post relies on ({post.factualBasis.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {post.factualBasis.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
