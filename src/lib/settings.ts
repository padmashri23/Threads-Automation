import type { StyleSettings } from "./types";

export const DEFAULT_SETTINGS: StyleSettings = {
  brandHandle: "@yourhandle",
  visualTheme: "dark",
  visualsMode: "auto",
  tone: "Professional, conversational, curious. Confident but never hype-driven.",
  audience:
    "Developers, IT professionals and technically curious people who follow AI closely but don't have time to read everything.",
  technicalDepth: "balanced",
  postLength: "standard",
  writingStyle:
    "Write like a technology professional sharing something genuinely interesting with peers. Plain language, concrete details, one clear point of view. Short sentences. No corporate or press-release phrasing.",
  preferredTopics: [
    "AI models",
    "AI agents",
    "AI coding tools",
    "open-source AI",
    "developer tools",
    "AI research",
    "AI hardware and chips",
  ],
  avoidTopics: ["celebrity gossip", "crypto price speculation", "politics unrelated to technology"],
  bannedPhrases: [
    "game-changer",
    "revolutionize",
    "in today's rapidly evolving",
    "here are 5 things",
    "buckle up",
    "let that sink in",
    "unleash",
    "delve",
    "it's not just X, it's Y",
  ],
  lookbackHours: 48,
  useEmoji: false,
  useHashtags: false,
};
