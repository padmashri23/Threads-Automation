import { createHash } from "crypto";

export function sha(input: string, len = 12): string {
  return createHash("sha1").update(input).digest("hex").slice(0, len);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function hoursSince(iso: string | undefined, now = Date.now()): number {
  if (!iso) return 999;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 999;
  return Math.max(0, (now - t) / 36e5);
}

export function domainOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return "";
  }
}

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "ref_src",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "s",
  "t",
  "guccounter",
];

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function round(n: number, d = 0): number {
  const m = 10 ** d;
  return Math.round(n * m) / m;
}

/** Run async tasks with limited concurrency. */
export async function pLimitAll<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (e) {
        results[i] = { status: "rejected", reason: e };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export function timeAgo(iso: string | undefined): string {
  if (!iso) return "unknown";
  const h = hoursSince(iso);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "";
  if (n >= 1_000_000) return `${round(n / 1_000_000, 1)}M`;
  if (n >= 1_000) return `${round(n / 1_000, 1)}k`;
  return String(n);
}

export function uniqBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of arr) {
    const k = key(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

export function safeDate(input: unknown): string {
  if (!input) return nowIso();
  const t = typeof input === "number" ? input : Date.parse(String(input));
  if (Number.isNaN(t)) return nowIso();
  return new Date(t).toISOString();
}
