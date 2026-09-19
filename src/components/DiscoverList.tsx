"use client";
import { useMemo, useState } from "react";
import type { Category, Story } from "@/lib/types";
import { StoryRow } from "./StoryRow";
type Sort = "trending" | "latest" | "quality";
const FILTERS: Array<{ key: string; label: string; match: (s: Story) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "ai", label: "AI", match: (s) => ["AI Models", "AI Agents", "AI Coding", "Research", "Regulation & Safety"].includes(s.category) || s.tags.some((t) => /\bai\b|llm|model/i.test(t)) },
  { key: "technology", label: "Technology", match: (s) => ["Big Tech", "Products", "Emerging Tech", "Hardware", "Developer Tools", "Cybersecurity"].includes(s.category) },
  { key: "research", label: "Research", match: (s) => s.category === "Research" },
  { key: "developer", label: "Developer", match: (s) => ["Developer Tools", "AI Coding", "Open Source"].includes(s.category) || s.assessment.devRelevance >= 7 },
  { key: "opensource", label: "Open Source", match: (s) => s.category === "Open Source" || s.tags.some((t) => /open[- ]?source/i.test(t)) },
  { key: "robotics", label: "Robotics", match: (s) => s.category === "Robotics" },
  { key: "startups", label: "Startups", match: (s) => s.category === "Startups" },
  { key: "security", label: "Cybersecurity", match: (s) => s.category === "Cybersecurity" },
  { key: "agents", label: "AI Agents", match: (s) => s.category === "AI Agents" || s.tags.some((t) => /agent/i.test(t)) },
  { key: "coding", label: "AI Coding", match: (s) => s.category === "AI Coding" },
  { key: "hardware", label: "Hardware", match: (s) => s.category === "Hardware" },
  { key: "bigtech", label: "Big Tech", match: (s) => s.category === "Big Tech" },
];
export function DiscoverList({ stories }: { stories: Story[] }) {
  const [sort, setSort] = useState<Sort>("trending");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [onlyAi, setOnlyAi] = useState(true);

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    const needle = q.trim().toLowerCase();
    let out = stories.filter(f.match);
    if (onlyAi) out = out.filter((s) => s.assessment.isAiTech);
    if (needle) out = out.filter((s) => `${s.headline} ${s.whatHappened} ${s.tags.join(" ")}`.toLowerCase().includes(needle));
    out = [...out].sort((a, b) => {
      if (sort === "latest") return Date.parse(b.freshness.earliestAt) - Date.parse(a.freshness.earliestAt);
      if (sort === "quality") return b.qualityScore - a.qualityScore;
      return b.trendScore - a.trendScore || b.overallScore - a.overallScore;
    });
    return out;
  }, [stories, sort, filter, q, onlyAi]);

  const counts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const s of stories) m.set(s.category, (m.get(s.category) ?? 0) + 1);
    return m;
  }, [stories]);
  void counts;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="flex rounded-lg border border-border p-0.5">
          {(["trending", "latest", "quality"] as Sort[]).map((k) => (
            <button key={k} onClick={() => setSort(k)} className={`rounded-md px-3 py-1 text-sm capitalize ${sort === k ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}>
              {k}
            </button>
          ))}
        </div>
        <input className="input max-w-xs" placeholder="Search stories…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="ml-auto flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={onlyAi} onChange={(e) => setOnlyAi(e.target.checked)} /> AI/tech only
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`chip cursor-pointer ${filter === f.key ? "bg-accent text-white" : "bg-surface border-border text-muted hover:text-fg"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{list.length} stories</p>
      <div className="grid gap-3">
        {list.map((s) => (
          <StoryRow key={s.id} story={s} showNote />
        ))}
      </div>
    </div>
  );
}
