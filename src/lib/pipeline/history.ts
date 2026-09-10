import { z } from "zod";
import type { HistoryEntry, RepeatCheck, Story } from "../types";
import { structured } from "../ai/client";
import { truncate } from "../utils";

const Schema = z.object({
  results: z.array(
    z.object({
      storyId: z.string(),
      verdict: z.enum(["new", "same-story", "new-development"]),
      historyId: z.string().nullable().describe("Id of the matching history entry, or null."),
      note: z.string().describe("One short sentence."),
    }),
  ),
});

const SYSTEM = `You help a content creator avoid repeating themselves. You get candidate stories for today and a list of stories they already covered recently.

For each candidate decide:
- "same-story": it is the same event the creator already covered, with no material new development (a repost, a follow-up article restating the same facts, a different outlet covering the same launch).
- "new-development": related to a covered story but there is a genuinely new development (a new release, a major reaction, a reversal, new data, a follow-on product).
- "new": not related to anything covered.

Be strict about "same-story": the creator would rather skip than repeat.`;

export async function checkRepeats(candidates: Story[], history: HistoryEntry[], lookbackDays = 14): Promise<Map<string, RepeatCheck>> {
  const out = new Map<string, RepeatCheck>();
  const since = Date.now() - lookbackDays * 864e5;
  const recent = history.filter((h) => Date.parse(h.date) >= since);
  if (!recent.length || !candidates.length) {
    for (const c of candidates) out.set(c.id, { verdict: "new" });
    return out;
  }
  const hist = recent
    .map((h) => `- id=${h.id} (${h.date.slice(0, 10)}, ${h.status}) "${h.headline}" — ${truncate(h.summary, 160)} [topic: ${h.topicKey}]`)
    .join("\n");
  const cands = candidates
    .map((c) => `- storyId=${c.id} "${c.headline}" — ${truncate(c.whatHappened, 220)} [topic: ${c.assessment.topicKey}]`)
    .join("\n");
  const r = await structured(Schema, SYSTEM, `ALREADY COVERED (last ${lookbackDays} days)\n${hist}\n\nCANDIDATES\n${cands}`, {
    effort: "medium",
    maxTokens: 4000,
  });
  const byId = new Map(recent.map((h) => [h.id, h]));
  for (const c of candidates) out.set(c.id, { verdict: "new" });
  for (const res of r.results) {
    if (!out.has(res.storyId)) continue;
    const h = res.historyId ? byId.get(res.historyId) : undefined;
    out.set(res.storyId, { verdict: res.verdict, historyId: h?.id, historyHeadline: h?.headline, note: res.note });
  }
  return out;
}
