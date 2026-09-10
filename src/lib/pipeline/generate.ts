import { z } from "zod";
import type { GeneratedPost, RefineAction, Story, StyleSettings } from "../types";
import { structured } from "../ai/client";
import { truncate } from "../utils";

const THREADS_LIMIT = 500;

const PostSchema = z.object({
  hook: z.string().describe("The first line of the post. Must be factually accurate and make a reader stop scrolling."),
  parts: z.array(z.string()).min(1).max(4).describe("Threads posts. One item for a single post; 2-4 items for a thread. Each under 500 characters."),
  angle: z.string().describe("One sentence: the point of view this post takes and why."),
  factualBasis: z.array(z.string()).describe("Which facts from the fact sheet the post relies on."),
});

function lengthRule(s: StyleSettings): string {
  switch (s.postLength) {
    case "short":
      return "Single post, at most 280 characters.";
    case "thread":
      return "A thread of 2 to 4 posts. Each post under 500 characters. The first post must stand on its own.";
    default:
      return "Single post, between 300 and 500 characters.";
  }
}

function depthRule(s: StyleSettings): string {
  switch (s.technicalDepth) {
    case "light":
      return "Keep technical detail light; explain any term a non-engineer would not know.";
    case "deep":
      return "Go technically deep where it adds insight: architectures, numbers, trade-offs, developer implications. Still readable.";
    default:
      return "Balanced technical depth: precise, but every sentence should be understandable by a technical generalist.";
  }
}

export function styleBlock(s: StyleSettings): string {
  return `WRITER PROFILE
Tone: ${s.tone}
Audience: ${s.audience}
Writing style: ${s.writingStyle}
Technical depth: ${depthRule(s)}
Length: ${lengthRule(s)}
Emoji: ${s.useEmoji ? "at most one, only if it genuinely helps" : "none"}
Hashtags: ${s.useHashtags ? "at most two, at the end" : "none"}
Preferred topics: ${s.preferredTopics.join(", ") || "none specified"}
Topics to avoid: ${s.avoidTopics.join(", ") || "none specified"}
Words/phrases never to use: ${s.bannedPhrases.join("; ") || "none specified"}`;
}

const SYSTEM = `You write Threads posts for a technology professional who publishes two posts a day about AI and technology. You are ghost-writing in their voice: a real person, on their own account, telling peers about something they found genuinely interesting. Not a news summary. Not a press release. Not "content".

Facts (non-negotiable):
1. Use ONLY the facts in the FACT SHEET and CONFIRMED CLAIMS. Never add numbers, quotes, features, dates, names or performance claims that are not there. A thin fact sheet means a shorter post, never an invented detail.
2. Never present an unverified claim as fact. Either mark it as reported and unconfirmed, or leave it out.
3. Each Threads post must be under 500 characters including spaces.

How a human actually writes this:
- Sound like one specific person with a point of view. Take a position on why this matters; don't hedge everything. First person ("I", "I've been…") is welcome when it fits.
- Start with the thing that made you stop, not with "Company X launched Y". A surprising number, a consequence, a question you're actually asking yourself, a comparison, a small detail that reveals the bigger picture. The hook must be true; no clickbait, no exaggeration.
- One idea per post. Pick the single most interesting angle and go deeper on it instead of listing every fact. Two or three concrete details beat six.
- Vary rhythm. Mix short punchy sentences with one longer one. Fragments are fine. Avoid three statistics in a row, avoid colon-heavy "X: Y" constructions, avoid symmetrical "not just A, but B" phrasing.
- Show reasoning, not just conclusions: "which means…", "the part I keep thinking about is…", "if this holds up…".
- End naturally: a takeaway, an honest open question, or what you'll be watching next. Not a summary, not a call to action, not "thoughts?".
- Plain words. Explain a technical term in passing if the audience might not know it. No jargon for its own sake.
- Never use: "game-changer", "revolutionize", "in today's rapidly evolving", "here are N things", "buckle up", "let that sink in", "unleash", "delve", "dive in", "excited to share", "huge news", generic motivation, emoji strings, hashtag walls, or the writer's banned phrases.
- Do not write like a listicle, a bulleted brief, or a headline followed by bullet points.

Respect the writer profile (tone, audience, length, banned phrases) exactly.`;

function contextBlock(story: Story): string {
  const fc = story.factCheck;
  const facts = fc?.factSheet?.length ? fc.factSheet.map((f) => `- ${f}`).join("\n") : "- (no verified facts beyond the headline; keep the post modest and clearly frame the event as reported)";
  const confirmed = fc?.confirmed?.length ? fc.confirmed.map((c) => `- ${c.claim} (${c.sourceName})`).join("\n") : "- none";
  const unverified = fc?.unverified?.length ? fc.unverified.map((u) => `- ${u}`).join("\n") : "- none";
  const conflicting = fc?.conflicting?.length ? fc.conflicting.map((u) => `- ${u}`).join("\n") : "- none";
  return `STORY
Headline: ${story.headline}
Category: ${story.category}
What happened: ${story.whatHappened}
Why it matters (editor note): ${story.whyItMatters}
Why it is trending: ${story.trendReasons.join("; ")}
Verification status: ${fc?.status ?? story.credibility} — ${fc?.statusReason ?? story.credibilityLabel}

FACT SHEET (verified, usable)
${facts}

CONFIRMED CLAIMS
${confirmed}

UNVERIFIED (do not state as fact)
${unverified}

CONFLICTING REPORTS
${conflicting}

ORIGINAL ITEM TITLES (context only, not a source of facts)
${story.items.slice(0, 8).map((i) => `- [${i.source}] ${truncate(i.title, 120)}`).join("\n")}`;
}

function finalize(parts: string[], hook: string, angle: string, factualBasis: string[], version: number, action?: string): GeneratedPost {
  const clean = parts.map((p) => p.trim()).filter(Boolean);
  return {
    text: clean.join("\n\n"),
    parts: clean,
    hook,
    angle,
    factualBasis,
    generatedAt: new Date().toISOString(),
    version,
    lastAction: action,
  };
}

async function callAndValidate(system: string, user: string, version: number, action?: string): Promise<GeneratedPost> {
  let r = await structured(PostSchema, system, user, { effort: "high", maxTokens: 4000, cacheSystem: true });
  const tooLong = r.parts.some((p) => p.length > THREADS_LIMIT);
  if (tooLong) {
    r = await structured(
      PostSchema,
      system,
      `${user}\n\nYOUR PREVIOUS DRAFT EXCEEDED 500 CHARACTERS IN AT LEAST ONE PART. Rewrite it so every part is under 500 characters, keeping the same facts and hook. Previous draft:\n${r.parts.join("\n---\n")}`,
      { effort: "medium", maxTokens: 4000, cacheSystem: true },
    );
  }
  return finalize(r.parts, r.hook, r.angle, r.factualBasis, version, action);
}

export async function generatePost(story: Story, settings: StyleSettings): Promise<GeneratedPost> {
  const user = `${styleBlock(settings)}\n\n${contextBlock(story)}\n\nWrite the Threads post now.`;
  return callAndValidate(SYSTEM, user, (story.post?.version ?? 0) + 1, "generate");
}

const ACTION_TEXT: Record<RefineAction, string> = {
  regenerate: "Write a fresh version with a different angle and a different hook. Same facts, same length rules.",
  shorter: "Make it noticeably shorter (cut at least a third) while keeping the hook and the single most important insight.",
  conversational: "Make it more conversational and personal, like talking to a colleague, without losing precision.",
  technical: "Make it more technical: add the concrete technical detail available in the fact sheet, and be specific about developer implications. Do not add anything not in the fact sheet.",
  hook: "Keep the body mostly as is, but rewrite the first line into a much stronger hook. It must stay accurate.",
  humanize:
    "Rewrite so it sounds unmistakably like a real person talking, not a summary: a clear point of view, first person where natural, varied sentence rhythm, one idea explored with reasoning ('which means…'), a natural ending. Remove anything that reads like a news brief or a list of facts. Keep every fact exactly as it is; do not add any.",
  custom: "Apply the writer's instruction below.",
};

export async function refinePost(
  story: Story,
  currentText: string,
  action: RefineAction,
  settings: StyleSettings,
  instruction?: string,
): Promise<GeneratedPost> {
  const user = `${styleBlock(settings)}\n\n${contextBlock(story)}\n\nCURRENT DRAFT (written by the user or a previous pass; preserve anything factual, and keep the user's edits unless the instruction requires changing them)\n${currentText}\n\nINSTRUCTION\n${ACTION_TEXT[action]}${instruction ? `\nWriter's instruction: ${instruction}` : ""}\n\nReturn the revised post. Do not introduce any fact that is not in the fact sheet or the current draft.`;
  return callAndValidate(SYSTEM, user, (story.post?.version ?? 0) + 1, action);
}
