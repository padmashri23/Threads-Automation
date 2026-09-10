import type { RawItem } from "../types";
import { fetchJson } from "../http";
import { safeDate, sha, truncate, uniqBy } from "../utils";

interface Repo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  pushed_at: string;
  topics?: string[];
  language?: string | null;
  owner?: { login: string };
}

interface SearchResp {
  items: Repo[];
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toItem(r: Repo, ageDays: number): RawItem {
  const url = r.html_url;
  const starsPerDay = r.stargazers_count / Math.max(1, ageDays);
  return {
    id: sha(url),
    source: "GitHub",
    sourceKind: "developer",
    title: `${r.full_name}: ${truncate(r.description ?? "", 120)}`.replace(/:\s*$/, ""),
    url,
    discussionUrl: url,
    domain: "github.com",
    publishedAt: safeDate(r.created_at),
    summary: truncate(
      `${r.description ?? ""} (${r.stargazers_count.toLocaleString()} stars, ~${Math.round(starsPerDay)}/day, ${r.language ?? "n/a"}${r.topics?.length ? ", topics: " + r.topics.slice(0, 6).join(", ") : ""})`,
      400,
    ),
    author: r.owner?.login,
    engagement: { stars: r.stargazers_count, forks: r.forks_count },
  };
}

/** New repositories gaining stars fast, plus recently-created AI repos. */
export async function collectGitHub(): Promise<RawItem[]> {
  const now = new Date();
  const d14 = ymd(new Date(now.getTime() - 14 * 864e5));
  const d5 = ymd(new Date(now.getTime() - 5 * 864e5));
  const aiTerms = "(llm OR agent OR agents OR ai OR gpt OR claude OR diffusion OR model OR mcp OR rag OR transformer OR robotics)";
  const queries = [
    `created:>${d14} stars:>300`,
    `created:>${d5} stars:>100`,
    `${aiTerms} created:>${d14} stars:>80`,
  ];
  const results = await Promise.allSettled(
    queries.map((q) =>
      fetchJson<SearchResp>(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=40`,
        { timeoutMs: 15000, headers: headers() },
      ),
    ),
  );
  const repos: Repo[] = [];
  for (const r of results) if (r.status === "fulfilled") repos.push(...r.value.items);
  const items = repos.map((r) => toItem(r, (now.getTime() - Date.parse(r.created_at)) / 864e5));
  return uniqBy(items, (i) => i.id);
}
