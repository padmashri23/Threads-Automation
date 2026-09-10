import type { RawItem } from "../types";
import { FEEDS } from "../sources/rss";

const AI_TECH = [
  /\bai\b/i,
  /artificial intelligence/i,
  /machine learning/i,
  /\bml\b/i,
  /\bllms?\b/i,
  /language model/i,
  /\bgpt-?\d?/i,
  /chatgpt/i,
  /openai/i,
  /anthropic/i,
  /\bclaude\b/i,
  /gemini/i,
  /deepmind/i,
  /\bllama\b/i,
  /mistral/i,
  /\bqwen\b/i,
  /deepseek/i,
  /\bgrok\b/i,
  /\bxai\b/i,
  /copilot/i,
  /cursor/i,
  /\bagents?\b/i,
  /agentic/i,
  /\bmcp\b/i,
  /neural/i,
  /transformer/i,
  /diffusion/i,
  /generative/i,
  /multimodal/i,
  /\brag\b/i,
  /embedding/i,
  /fine-?tun/i,
  /inference/i,
  /\bgpus?\b/i,
  /nvidia/i,
  /\bamd\b/i,
  /\btsmc\b/i,
  /\bchips?\b/i,
  /semiconductor/i,
  /\bcuda\b/i,
  /robot/i,
  /humanoid/i,
  /autonomous/i,
  /self-driving/i,
  /open[- ]source/i,
  /github/i,
  /developer/i,
  /programming/i,
  /\bcoding\b/i,
  /software/i,
  /\bapi\b/i,
  /cloud/i,
  /kubernetes/i,
  /\brust\b/i,
  /python/i,
  /typescript/i,
  /javascript/i,
  /linux/i,
  /quantum/i,
  /cyber/i,
  /security/i,
  /\bhack/i,
  /breach/i,
  /vulnerab/i,
  /malware/i,
  /ransomware/i,
  /encryption/i,
  /data ?center/i,
  /compute/i,
  /startup/i,
  /funding/i,
  /raises \$/i,
  /acquisition/i,
  /acquires/i,
  /\bapple\b/i,
  /\bgoogle\b/i,
  /microsoft/i,
  /\bmeta\b/i,
  /amazon/i,
  /\baws\b/i,
  /azure/i,
  /tesla/i,
  /spacex/i,
  /\bar\b|\bvr\b|\bxr\b/i,
  /headset/i,
  /smart ?glasses/i,
  /wearable/i,
  /\bapp\b/i,
  /browser/i,
  /chrome/i,
  /android/i,
  /\bios\b/i,
  /iphone/i,
  /windows/i,
  /regulat/i,
  /\bai act\b/i,
  /safety/i,
  /alignment/i,
  /benchmark/i,
  /model/i,
  /dataset/i,
  /research/i,
  /paper/i,
  /breakthrough/i,
  /battery/i,
  /\bev\b/i,
  /satellite/i,
  /5g|6g/i,
  /biotech/i,
  /crispr/i,
  /fusion/i,
  /drone/i,
  /chatbot/i,
  /assistant/i,
  /voice/i,
  /vision/i,
  /image generation/i,
  /video generation/i,
  /text-to-/i,
  /deepfake/i,
  /watermark/i,
  /token/i,
  /context window/i,
];

const NOISE = [
  /\bdeal\b.*\b(off|save|discount|%)/i,
  /best .* (deals|to buy)/i,
  /black friday/i,
  /prime day/i,
  /\bhoroscope\b/i,
  /wordle|crossword|puzzle answer/i,
  /\breview:/i,
  /giveaway/i,
  /\bcoupon/i,
  /\bnfl\b|\bnba\b|\bmlb\b|premier league/i,
  /\bmovie\b|\btrailer\b|box office|\bnetflix\b.*(season|episode)/i,
  /\bcrypto\b.*(price|rally|dip)|bitcoin price|memecoin/i,
];

const aiFocusedFeeds = new Set(FEEDS.filter((f) => f.aiFocused).map((f) => f.name));

export function isRelevant(item: RawItem): boolean {
  const text = `${item.title} ${item.summary ?? ""}`;
  if (NOISE.some((r) => r.test(text))) return false;
  if (aiFocusedFeeds.has(item.source)) return true;
  if (["research", "developer", "official"].includes(item.sourceKind)) return true;
  if (item.sourceKind === "aggregator") return true; // Google News queries are already AI-scoped
  if (item.source.startsWith("Reddit r/") && !["technology", "programming"].includes(item.source.slice(9))) return true;
  return AI_TECH.some((r) => r.test(text));
}

/** Cheap pre-score used only to cap what goes to the clustering model. */
export function preScore(item: RawItem, now = Date.now()): number {
  const e = item.engagement;
  let s = 0;
  const mentions = 1 + (item.mentions?.length ?? 0);
  s += Math.min(30, mentions * 8);
  const all = [item, ...(item.mentions ?? [])];
  for (const m of all) {
    const eg = m.engagement;
    s += Math.min(25, Math.log10(1 + (eg.points ?? 0) + (eg.upvotes ?? 0)) * 8);
    s += Math.min(10, Math.log10(1 + (eg.comments ?? 0)) * 4);
    s += Math.min(20, Math.log10(1 + (eg.stars ?? 0)) * 5);
    s += Math.min(10, Math.log10(1 + (eg.views ?? 0)) * 2);
    s += Math.min(10, Math.log10(1 + (eg.likes ?? 0)) * 3);
  }
  void e;
  const kindBonus: Record<string, number> = { official: 14, publication: 8, research: 3, developer: 6, community: 6, social: 4, video: 3, aggregator: 4 };
  s += kindBonus[item.sourceKind] ?? 0;
  const ageH = Math.max(0, (now - Date.parse(item.publishedAt)) / 36e5);
  s += Math.max(0, 12 - ageH / 4);
  return s;
}
