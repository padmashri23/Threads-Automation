import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * Model provider layer. One function, `structured()`, is used by the whole pipeline:
 * system prompt + user prompt in, schema-validated JSON out.
 *
 * Providers (chosen by LLM_PROVIDER, or auto-detected from which key is present):
 *  - gemini            Google AI Studio (free tier, no card). GEMINI_API_KEY, GEMINI_MODEL(S)
 *  - openai-compatible Groq / OpenRouter / Mistral / Ollama / any OpenAI-style endpoint.
 *                      OPENAI_COMPAT_API_KEY, OPENAI_COMPAT_BASE_URL, OPENAI_COMPAT_MODEL
 *  - anthropic         Claude (paid). ANTHROPIC_API_KEY, CLAUDE_MODEL
 */
export type Provider = "gemini" | "openai-compatible" | "anthropic";

export function getProvider(): Provider | null {
  const forced = process.env.LLM_PROVIDER as Provider | undefined;
  if (forced && ["gemini", "openai-compatible", "anthropic"].includes(forced)) return forced;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_COMPAT_API_KEY) return "openai-compatible";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  return null;
}

export function hasApiKey(): boolean {
  const p = getProvider();
  if (p === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  if (p === "openai-compatible") return Boolean(process.env.OPENAI_COMPAT_API_KEY);
  if (p === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return false;
}

export function providerLabel(): string {
  const p = getProvider();
  if (p === "gemini") {
    const pool = geminiPool();
    return `Gemini ${pool[0]}${pool.length > 1 ? ` (+${pool.length - 1} fallbacks)` : ""}`;
  }
  if (p === "openai-compatible") return `${process.env.OPENAI_COMPAT_MODEL ?? OPENAI_COMPAT_DEFAULT_MODEL} via ${process.env.OPENAI_COMPAT_BASE_URL ?? OPENAI_COMPAT_DEFAULT_URL}`;
  if (p === "anthropic") return `Claude (${process.env.CLAUDE_MODEL ?? "claude-opus-5"})`;
  return "not configured";
}

/** Free tiers have low requests-per-minute limits; keep parallel calls modest. */
export function aiConcurrency(): number {
  return getProvider() === "anthropic" ? 3 : 2;
}

export const SETUP_MESSAGE =
  "No model configured. Add GEMINI_API_KEY (free, from Google AI Studio) or another provider key to .env.local and restart the app.";

const GEMINI_DEFAULT_MODEL = "gemini-3.7-flash";
/** Free-tier quotas are per model per day, so a pool of models multiplies the free budget. */
const GEMINI_DEFAULT_POOL = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];
const OPENAI_COMPAT_DEFAULT_URL = "https://api.groq.com/openai/v1";
const OPENAI_COMPAT_DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class AiRefusalError extends Error {
  constructor(public category: string | null | undefined, explanation?: string | null) {
    super(`The model declined this request${category ? ` (${category})` : ""}${explanation ? `: ${explanation}` : ""}`);
  }
}

export interface StructuredOpts {
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  cacheSystem?: boolean;
}

export async function structured<T extends z.ZodType>(schema: T, system: string, user: string, opts: StructuredOpts = {}): Promise<z.infer<T>> {
  const p = getProvider();
  if (!p) throw new Error(SETUP_MESSAGE);
  if (p === "anthropic") return anthropicStructured(schema, system, user, opts);
  if (p === "gemini") return jsonProviderStructured(schema, system, user, opts, callGemini);
  return jsonProviderStructured(schema, system, user, opts, callOpenAICompatible);
}

// ---------------------------------------------------------------------------
// Generic JSON providers (Gemini, OpenAI-compatible): schema goes into the prompt,
// output is parsed and validated with zod, one corrective retry on failure.
// ---------------------------------------------------------------------------

type JsonCaller = (system: string, user: string, maxTokens: number) => Promise<string>;

function schemaInstruction<T extends z.ZodType>(schema: T): string {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  return `\n\nOUTPUT FORMAT\nRespond with a single JSON object and nothing else (no prose, no markdown fences). It must match this JSON Schema exactly, including all required fields:\n${JSON.stringify(js)}`;
}

function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t;
}

async function jsonProviderStructured<T extends z.ZodType>(schema: T, system: string, user: string, opts: StructuredOpts, call: JsonCaller): Promise<z.infer<T>> {
  const sys = system + schemaInstruction(schema);
  const maxTokens = opts.maxTokens ?? 16000;
  let raw = await withRetries(() => call(sys, user, maxTokens));
  for (let attempt = 0; attempt < 2; attempt++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (e) {
      if (attempt === 1) throw new Error(`Model returned invalid JSON: ${(e as Error).message}`);
      raw = await withRetries(() => call(sys, `${user}\n\nYour previous reply was not valid JSON. Reply again with only the JSON object.`, maxTokens));
      continue;
    }
    const res = schema.safeParse(parsed);
    if (res.success) return res.data;
    if (attempt === 1) throw new Error(`Model output did not match the expected structure: ${res.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    raw = await withRetries(() =>
      call(sys, `${user}\n\nYour previous JSON had these problems: ${res.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ")}. Reply again with a corrected JSON object only.`, maxTokens),
    );
  }
  throw new Error("Model output could not be validated.");
}

class HttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}: ${body.slice(0, 300)}`);
  }
}

/** Retry on transient server errors and per-minute rate limits. */
async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [8000, 20000, 45000];
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof QuotaExhaustedError) throw e; // no point retrying a daily quota
      const msg = (e as Error).message;
      const retryable = /\b(429|503|502|500|overloaded|rate|quota|RESOURCE_EXHAUSTED|fetch failed|ECONNRESET|timeout|high demand)\b/i.test(msg);
      if (!retryable || i >= delays.length) throw e;
      await new Promise((r) => setTimeout(r, delays[i]));
    }
  }
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8 * 60 * 1000);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

// ---- Google AI Studio (Gemini) with a model pool ----
interface GeminiResp {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export class QuotaExhaustedError extends Error {}

type G = typeof globalThis & { __geminiCooldown?: Map<string, number> };
function cooldowns(): Map<string, number> {
  const g = globalThis as G;
  if (!g.__geminiCooldown) g.__geminiCooldown = new Map();
  return g.__geminiCooldown;
}

export function geminiPool(): string[] {
  const listed = (process.env.GEMINI_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const primary = process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL;
  const all = [primary, ...(fallback ? [fallback] : []), ...(listed.length ? listed : GEMINI_DEFAULT_POOL)];
  return [...new Set(all)];
}

/** Human-readable quota status for the UI. */
export function geminiQuotaStatus(): Array<{ model: string; availableAt: number | null }> {
  const cd = cooldowns();
  const now = Date.now();
  return geminiPool().map((m) => {
    const until = cd.get(m);
    return { model: m, availableAt: until && until > now ? until : null };
  });
}

function nextPacificMidnight(): number {
  // Free-tier daily quotas reset at midnight Pacific time.
  const now = new Date();
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offset = now.getTime() - pt.getTime();
  const midnight = new Date(pt);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() + offset + 60_000;
}

async function geminiRequest(model: string, system: string, user: string): Promise<GeminiResp> {
  return (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 65536 /* thinking tokens count against this on Gemini 3.x */, temperature: 0.4 },
    },
    { "x-goog-api-key": process.env.GEMINI_API_KEY! },
  )) as GeminiResp;
}

const callGemini: JsonCaller = async (system, user) => {
  const pool = geminiPool();
  const cd = cooldowns();
  const now = Date.now();
  const errors: string[] = [];
  for (const model of pool) {
    const until = cd.get(model);
    if (until && until > now) continue;
    let r: GeminiResp;
    try {
      r = await geminiRequest(model, system, user);
    } catch (e) {
      if (e instanceof HttpError && (e.status === 429 || e.status === 503)) {
        const daily = /PerDay/i.test(e.body);
        const wait = daily ? nextPacificMidnight() : Date.now() + 65_000;
        cd.set(model, wait);
        errors.push(`${model}: ${daily ? "daily free quota used up" : e.status === 503 ? "busy" : "per-minute limit"}`);
        continue; // try the next model in the pool
      }
      throw e;
    }
    if (r.promptFeedback?.blockReason) throw new AiRefusalError(r.promptFeedback.blockReason);
    const cand = r.candidates?.[0];
    const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    if (!text) {
      errors.push(`${model}: returned no text (${cand?.finishReason ?? "unknown"})`);
      continue;
    }
    if (cand?.finishReason === "MAX_TOKENS") throw new Error("Model output was cut off (max tokens). Try again or reduce the research window.");
    return text;
  }
  const allDaily = pool.every((m) => (cd.get(m) ?? 0) > Date.now() + 10 * 60_000);
  if (allDaily) throw new QuotaExhaustedError(`Every Gemini model in the pool has used its free daily quota (${errors.join("; ")}). Quotas reset at midnight Pacific time.`);
  throw new Error(`No Gemini model is available right now (${errors.join("; ") || "all cooling down"}). Retrying shortly.`);
};

// ---- OpenAI-compatible (Groq, OpenRouter, Mistral, Ollama, ...) ----
interface OpenAIResp {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  error?: { message?: string };
}

const callOpenAICompatible: JsonCaller = async (system, user, maxTokens) => {
  const key = process.env.OPENAI_COMPAT_API_KEY!;
  const base = (process.env.OPENAI_COMPAT_BASE_URL ?? OPENAI_COMPAT_DEFAULT_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_COMPAT_MODEL ?? OPENAI_COMPAT_DEFAULT_MODEL;
  const r = (await postJson(
    `${base}/chat/completions`,
    {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: Math.min(maxTokens, Number(process.env.OPENAI_COMPAT_MAX_TOKENS ?? 16000)),
      temperature: 0.4,
    },
    { Authorization: `Bearer ${key}` },
  )) as OpenAIResp;
  const choice = r.choices?.[0];
  const text = choice?.message?.content ?? "";
  if (!text) throw new Error(r.error?.message ?? "Model returned no text");
  if (choice?.finish_reason === "length") throw new Error("Model output was cut off (max tokens). Try again or reduce the research window.");
  return text;
};

// ---------------------------------------------------------------------------
// Anthropic (paid): native structured outputs.
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ timeout: 10 * 60 * 1000, maxRetries: 2 });
  return anthropicClient;
}

async function anthropicStructured<T extends z.ZodType>(schema: T, system: string, user: string, opts: StructuredOpts): Promise<z.infer<T>> {
  const c = getAnthropic();
  const model = process.env.CLAUDE_MODEL ?? "claude-opus-5";
  let useFallbacks = true;
  const attempt = async (): Promise<z.infer<T>> => {
    const res = await c.beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      // Server-side refusal fallbacks: if the model declines, the API re-runs on a fallback model.
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system: [{ type: "text", text: system, ...(opts.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}) }],
      messages: [{ role: "user", content: user }],
      output_config: { format: betaZodOutputFormat(schema), effort: opts.effort ?? "high" },
    });
    if (res.stop_reason === "refusal") throw new AiRefusalError(res.stop_details?.category, res.stop_details?.explanation);
    if (res.stop_reason === "max_tokens") throw new Error("Model output was cut off (max_tokens). Try again or reduce input size.");
    if (res.parsed_output == null) throw new Error("Model returned output that did not match the expected structure.");
    return res.parsed_output as z.infer<T>;
  };
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof AiRefusalError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Anthropic API key is missing or invalid.");
    if (e instanceof Anthropic.RateLimitError) {
      await new Promise((r) => setTimeout(r, 4000));
      return attempt();
    }
    if (e instanceof Anthropic.BadRequestError && useFallbacks && /fallback|beta/i.test(e.message)) {
      useFallbacks = false;
      return attempt();
    }
    if (!(e instanceof Anthropic.BadRequestError)) return attempt();
    throw e;
  }
}
