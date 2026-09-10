import { z } from "zod";
import type { Story, StyleSettings, Visuals } from "../types";
import { structured } from "../ai/client";
import { truncate } from "../utils";

const SlideSchema = z.object({
  kind: z.enum(["cover", "point", "stat", "quote", "closing"]),
  kicker: z.string().nullable().describe("Short label above the title (max 28 chars), e.g. 'What happened', 'Why it matters', '1/4'. Null if not needed."),
  title: z.string().describe("Main text of the slide. Cover: max 70 chars. Others: max 60 chars."),
  body: z.string().nullable().describe("Supporting text, max 170 chars, plain language. Null for stat/quote slides if the title says it all."),
  stat: z.string().nullable().describe("Stat slides only: the exact figure copied verbatim from the fact sheet, e.g. '$10 / 1M tokens' or '88 hours'. Null otherwise."),
  source: z.string().nullable().describe("Attribution shown small in the footer, e.g. 'OpenAI blog', 'per TechCrunch'. Null if none."),
});

const PlanSchema = z.object({
  mode: z.enum(["none", "single", "carousel"]),
  reason: z.string().describe("One sentence explaining why this format suits the story."),
  slides: z.array(SlideSchema).max(6),
});

const SYSTEM = `You design simple, high-signal image cards for Threads posts by a technology professional. The cards are rendered from your text by a template (dark or light editorial style, one accent colour, brand handle in the footer). You do not draw pictures; you write what goes on each card.

Decide the format:
- "none": the verified fact sheet is too thin for a card, or the post works better as plain text.
- "single": one cover card. Right for a clean announcement with a single strong headline.
- "carousel": 3 to 6 cards. Right when there are at least three distinct verified points worth separating: what happened, the key numbers, why it matters, what happens next.

Card rules:
- Card 1 is always "cover" in a carousel: a strong, accurate headline plus a one-line body that sets up the swipe.
- Middle cards are "point", "stat" or "quote". Use "stat" only when the exact figure is in the fact sheet; copy it verbatim. Use "quote" only for a verbatim quote present in the fact sheet, with its source.
- The last card of a carousel is "closing": the takeaway, and optionally a question that invites replies.
- Every word must be supported by the fact sheet or confirmed claims. No invented numbers, features, quotes or dates. If unsure, leave it out.
- Short, concrete, human. No hype words, no emoji, no hashtags. Title case is not required; write like a person.
- Numbering (e.g. "2/5") is added by the template; do not put it in the text.`;

export async function planVisuals(story: Story, settings: StyleSettings, mode: "auto" | "single" | "carousel", instruction?: string): Promise<Omit<Visuals, "generatedAt" | "version" | "width" | "height">> {
  const fc = story.factCheck;
  const facts = fc?.factSheet?.length ? fc.factSheet.map((f) => `- ${f}`).join("\n") : "- (none verified)";
  const confirmed = fc?.confirmed?.length ? fc.confirmed.map((c) => `- ${c.claim} (${c.sourceName})`).join("\n") : "- none";
  const modeRule =
    mode === "single"
      ? "The writer asked for a SINGLE cover card. Set mode to 'single' and return exactly one cover slide."
      : mode === "carousel"
        ? "The writer asked for a CAROUSEL. Set mode to 'carousel' and return 3 to 6 slides, unless the facts genuinely cannot support three cards, in which case return 'single'."
        : "Choose the format yourself based on the rules.";
  const user = `STORY
Headline: ${story.headline}
Category: ${story.category}
What happened: ${story.whatHappened}
Why it matters: ${story.whyItMatters}

THREADS POST (the cards accompany this text; do not repeat it word for word)
${story.post?.text ?? "(not written yet)"}

FACT SHEET (verified)
${facts}

CONFIRMED CLAIMS
${confirmed}

UNVERIFIED (never use)
${(fc?.unverified ?? []).map((u) => `- ${u}`).join("\n") || "- none"}

WRITER PROFILE
Audience: ${truncate(settings.audience, 200)}
Tone: ${truncate(settings.tone, 120)}
Banned phrases: ${settings.bannedPhrases.join("; ") || "none"}

FORMAT INSTRUCTION
${modeRule}${instruction ? `\nWriter's extra instruction: ${instruction}` : ""}`;

  const r = await structured(PlanSchema, SYSTEM, user, { effort: "medium", maxTokens: 4000 });
  let slides = r.slides;
  let finalMode = r.mode;
  if (finalMode === "carousel" && slides.length < 2) finalMode = slides.length === 1 ? "single" : "none";
  if (finalMode === "single") slides = slides.slice(0, 1);
  if (finalMode === "none") slides = [];
  return { mode: finalMode, reason: r.reason, slides };
}
