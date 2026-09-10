import fs from "fs";
import path from "path";
import type { HistoryEntry, Run, Story, StyleSettings } from "./types";
import { DEFAULT_SETTINGS } from "./settings";

const DATA_DIR = path.join(process.cwd(), "data");
const RUNS_DIR = path.join(DATA_DIR, "runs");
const STORIES_DIR = path.join(DATA_DIR, "stories");
const CACHE_DIR = path.join(DATA_DIR, "cache");

function ensureDirs() {
  for (const d of [DATA_DIR, RUNS_DIR, STORIES_DIR, CACHE_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  ensureDirs();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

// ---------- Settings ----------
export function getSettings(): StyleSettings {
  const s = readJson<Partial<StyleSettings>>(path.join(DATA_DIR, "settings.json"), {});
  return { ...DEFAULT_SETTINGS, ...s };
}

export function saveSettings(s: StyleSettings) {
  writeJson(path.join(DATA_DIR, "settings.json"), s);
}

// ---------- Runs ----------
export function saveRun(run: Run) {
  writeJson(path.join(RUNS_DIR, `${run.id}.json`), run);
  writeJson(path.join(DATA_DIR, "latest.json"), { runId: run.id, updatedAt: new Date().toISOString() });
}

export function getRun(id: string): Run | null {
  return readJson<Run | null>(path.join(RUNS_DIR, `${id}.json`), null);
}

export function getLatestRun(): Run | null {
  const p = readJson<{ runId: string } | null>(path.join(DATA_DIR, "latest.json"), null);
  if (!p) return null;
  return getRun(p.runId);
}

export function listRuns(limit = 20): Run[] {
  ensureDirs();
  const files = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, t: fs.statSync(path.join(RUNS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(0, limit);
  return files.map((x) => readJson<Run | null>(path.join(RUNS_DIR, x.f), null)).filter(Boolean) as Run[];
}

// ---------- Stories ----------
export function saveStories(runId: string, stories: Story[]) {
  writeJson(path.join(STORIES_DIR, `${runId}.json`), stories);
}

export function getStories(runId: string): Story[] {
  return readJson<Story[]>(path.join(STORIES_DIR, `${runId}.json`), []);
}

export function getStory(storyId: string): Story | null {
  // story ids embed run id: `${runId}-${n}`
  const runId = storyId.split("-").slice(0, -1).join("-");
  const stories = getStories(runId);
  return stories.find((s) => s.id === storyId) ?? null;
}

export function updateStory(storyId: string, patch: Partial<Story>): Story | null {
  const runId = storyId.split("-").slice(0, -1).join("-");
  const stories = getStories(runId);
  const idx = stories.findIndex((s) => s.id === storyId);
  if (idx < 0) return null;
  stories[idx] = { ...stories[idx], ...patch };
  saveStories(runId, stories);
  return stories[idx];
}

// ---------- History ----------
export function getHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>(path.join(DATA_DIR, "history.json"), []);
}

export function saveHistory(entries: HistoryEntry[]) {
  writeJson(path.join(DATA_DIR, "history.json"), entries);
}

export function upsertHistory(entry: HistoryEntry) {
  const all = getHistory();
  const idx = all.findIndex((h) => h.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  saveHistory(all);
}

export function updateHistory(id: string, patch: Partial<HistoryEntry>): HistoryEntry | null {
  const all = getHistory();
  const idx = all.findIndex((h) => h.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  saveHistory(all);
  return all[idx];
}

// ---------- Cache (small key/value, e.g. resolved channel ids) ----------
export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  const file = path.join(CACHE_DIR, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
  const v = readJson<{ at: number; value: T } | null>(file, null);
  if (!v) return null;
  if (Date.now() - v.at > maxAgeMs) return null;
  return v.value;
}

export function cacheSet<T>(key: string, value: T) {
  const file = path.join(CACHE_DIR, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
  writeJson(file, { at: Date.now(), value });
}
