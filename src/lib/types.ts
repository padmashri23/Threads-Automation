// Shared domain types for the Threads AI editor.

export type SourceKind =
  | "official" // company / lab announcement, primary source
  | "publication" // journalism (TechCrunch, Verge, Reuters, ...)
  | "social" // X, Reddit, Bluesky
  | "community" // Hacker News, Lobsters
  | "developer" // GitHub, Hugging Face, Product Hunt
  | "research" // arXiv, HF papers
  | "video" // YouTube
  | "aggregator"; // Google News wide-net

export interface Engagement {
  points?: number; // HN / Lobsters / Reddit score
  comments?: number;
  stars?: number; // GitHub
  forks?: number;
  likes?: number; // HF / X / Bluesky
  downloads?: number; // HF
  views?: number; // YouTube
  upvotes?: number; // HF papers / Product Hunt
  reposts?: number; // X
}

export interface RawItem {
  id: string;
  source: string; // display name, e.g. "Hacker News"
  sourceKind: SourceKind;
  title: string;
  url: string; // canonical link to the content
  discussionUrl?: string; // HN/Reddit thread, GitHub repo page, etc.
  domain: string;
  publishedAt: string; // ISO
  summary?: string;
  author?: string;
  engagement: Engagement;
  /** Secondary mentions merged in when the same URL appeared in multiple places. */
  mentions?: Array<{ source: string; url: string; engagement: Engagement; publishedAt: string }>;
}

export interface SourceReport {
  source: string;
  count: number;
  ok: boolean;
  note?: string;
  ms: number;
}

export type Category =
  | "AI Models"
  | "AI Agents"
  | "AI Coding"
  | "Research"
  | "Open Source"
  | "Developer Tools"
  | "Robotics"
  | "Hardware"
  | "Startups"
  | "Cybersecurity"
  | "Big Tech"
  | "Regulation & Safety"
  | "Products"
  | "Emerging Tech";

export const CATEGORIES: Category[] = [
  "AI Models",
  "AI Agents",
  "AI Coding",
  "Research",
  "Open Source",
  "Developer Tools",
  "Robotics",
  "Hardware",
  "Startups",
  "Cybersecurity",
  "Big Tech",
  "Regulation & Safety",
  "Products",
  "Emerging Tech",
];

export type Credibility =
  | "official"
  | "reliable"
  | "early"
  | "rumor"
  | "unverified"
  | "conflicting";

export interface SourceRef {
  name: string;
  url: string;
  kind: SourceKind;
  label: string; // "Official announcement", "Discussion (312 points)", ...
  publishedAt?: string;
}

export interface SignalBreakdown {
  coverage: number; // independent outlets covering it
  discussion: number; // HN/Reddit/Lobsters velocity
  developer: number; // GitHub / HF traction
  official: number; // official/primary source present
  freshness: number; // recency + momentum
  video: number; // YouTube interest
}

export interface AiAssessment {
  isAiTech: boolean;
  importance: number; // 0-10
  novelty: number; // 0-10
  discussability: number; // 0-10
  devRelevance: number; // 0-10
  viralButShallow: boolean;
  repostOfOldNews: boolean;
  rationale: string;
  topicKey: string;
  primaryEntity?: string; // main company / lab / project the story is about
}

export interface FactCheck {
  status: Credibility;
  statusReason: string;
  confirmed: Array<{ claim: string; sourceUrl: string; sourceName: string }>;
  unverified: string[];
  conflicting: string[];
  factSheet: string[]; // grounded facts usable for writing
  checkedUrls: string[];
  checkedAt: string;
}

export interface GeneratedPost {
  text: string; // full post (may contain multiple parts separated by blank lines for a thread)
  parts: string[];
  hook: string;
  angle: string;
  factualBasis: string[];
  generatedAt: string;
  version: number;
  lastAction?: string;
}

export interface RepeatCheck {
  verdict: "new" | "same-story" | "new-development";
  historyId?: string;
  historyHeadline?: string;
  note?: string;
}

export interface Story {
  id: string;
  runId: string;
  headline: string;
  whatHappened: string;
  summary: string;
  whyItMatters: string;
  category: Category;
  tags: string[];
  items: RawItem[];
  sources: SourceRef[];
  sourceCount: number;
  independentSourceCount: number;
  trendScore: number;
  qualityScore: number;
  overallScore: number;
  trendReasons: string[];
  signals: SignalBreakdown;
  freshness: { latestAt: string; earliestAt: string; label: string; hoursOld: number };
  credibility: Credibility;
  credibilityLabel: string;
  factCheck?: FactCheck;
  relatedStoryIds: string[];
  assessment: AiAssessment;
  repeat?: RepeatCheck;
  rank?: number; // 1 or 2 when selected
  selected: boolean;
  post?: GeneratedPost;
  selectionNote?: string;
  visuals?: Visuals;
  createdAt: string;
}

export type RunStatus = "running" | "done" | "error";

export interface RunProgress {
  stage: string;
  message: string;
  pct: number;
  log: string[];
}

export interface Run {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: RunStatus;
  error?: string;
  progress: RunProgress;
  stats: {
    sourcesQueried: number;
    sourcesOk: number;
    itemsCollected: number;
    itemsRelevant: number;
    clusters: number;
    candidates: number;
    sourceReports: SourceReport[];
  };
  storyIds: string[];
  topPicks: string[];
  runnerUps: string[];
  editorNote: string;
}

export type HistoryStatus = "suggested" | "published" | "skipped";

export interface HistoryEntry {
  id: string;
  date: string; // ISO
  runId: string;
  storyId: string;
  headline: string;
  summary: string;
  category: Category;
  topicKey: string;
  trendScore: number;
  qualityScore: number;
  post: string;
  status: HistoryStatus;
  sources: SourceRef[];
}

export type SlideKind = "cover" | "point" | "stat" | "quote" | "closing";

export interface Slide {
  kind: SlideKind;
  kicker?: string | null; // small label above the title
  title: string;
  body?: string | null;
  stat?: string | null; // big figure for stat slides, verbatim from the fact sheet
  source?: string | null; // attribution shown in the footer
  file?: string; // rendered PNG file name
}

export interface Visuals {
  mode: "none" | "single" | "carousel";
  reason: string;
  slides: Slide[];
  width: number;
  height: number;
  generatedAt: string;
  version: number;
}

export interface StyleSettings {
  brandHandle: string; // shown on every slide, e.g. "@yourname"
  visualTheme: "dark" | "light";
  visualsMode: "auto" | "always" | "never";
  tone: string;
  audience: string;
  technicalDepth: "light" | "balanced" | "deep";
  postLength: "short" | "standard" | "thread";
  writingStyle: string;
  preferredTopics: string[];
  avoidTopics: string[];
  bannedPhrases: string[];
  lookbackHours: number;
  useEmoji: boolean;
  useHashtags: boolean;
}

export type RefineAction =
  | "regenerate"
  | "shorter"
  | "conversational"
  | "technical"
  | "hook"
  | "humanize"
  | "custom";
