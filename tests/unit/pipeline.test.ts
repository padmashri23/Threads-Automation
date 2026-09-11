import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeByUrl, preCluster, tokens } from "../../src/lib/pipeline/cluster";
import { isRelevant, preScore } from "../../src/lib/pipeline/relevance";
import { credibilityAdjustment, scoreCluster } from "../../src/lib/pipeline/scoring";
import type { AiAssessment, RawItem } from "../../src/lib/types";

const now = Date.parse("2026-09-11T12:00:00.000Z");

function item(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "item-1",
    source: "TechCrunch",
    sourceKind: "publication",
    title: "OpenAI releases a new coding model",
    url: "https://techcrunch.com/example",
    domain: "techcrunch.com",
    publishedAt: "2026-09-11T10:00:00.000Z",
    summary: "A model release for software developers.",
    engagement: {},
    ...overrides,
  };
}

const strongAssessment: AiAssessment = {
  isAiTech: true,
  importance: 9,
  novelty: 8,
  discussability: 8,
  devRelevance: 9,
  viralButShallow: false,
  repostOfOldNews: false,
  rationale: "Material developer release",
  topicKey: "openai-coding-model",
  primaryEntity: "OpenAI",
};

describe("relevance filtering", () => {
  it("keeps AI stories and rejects deal-driven noise", () => {
    assert.equal(isRelevant(item()), true);
    assert.equal(isRelevant(item({ title: "Best AI laptop deals: save 50% off today" })), false);
  });

  it("keeps primary technical sources even without a keyword match", () => {
    assert.equal(isRelevant(item({ sourceKind: "official", title: "Quarterly engineering update" })), true);
  });

  it("ranks a fresh official item above a stale publication item", () => {
    const official = item({ sourceKind: "official", domain: "openai.com" });
    const stale = item({ publishedAt: "2026-09-01T10:00:00.000Z" });
    assert.ok(preScore(official, now) > preScore(stale, now));
  });
});

describe("deterministic clustering", () => {
  it("normalizes headline tokens", () => {
    assert.deepEqual([...tokens("OpenAI launches GPT-6: a new coding model")], [
      "openai",
      "gpt-6",
      "coding",
      "model",
    ]);
  });

  it("merges duplicate URLs while retaining the primary source and discussion", () => {
    const discussion = item({
      id: "hn-1",
      source: "Hacker News",
      sourceKind: "community",
      discussionUrl: "https://news.ycombinator.com/item?id=1",
      publishedAt: "2026-09-11T09:00:00.000Z",
      engagement: { points: 320, comments: 84 },
    });
    const official = item({
      id: "official-1",
      source: "OpenAI",
      sourceKind: "official",
      domain: "openai.com",
    });

    const [merged] = mergeByUrl([discussion, official]);
    assert.equal(merged.source, "OpenAI");
    assert.equal(merged.publishedAt, discussion.publishedAt);
    assert.equal(merged.mentions?.[0].source, "Hacker News");
    assert.equal(merged.mentions?.[0].url, discussion.discussionUrl);
  });

  it("groups equivalent headlines and leaves unrelated events separate", () => {
    const clusters = preCluster([
      item({ id: "a", title: "OpenAI releases GPT-6 coding model today" }),
      item({ id: "b", url: "https://example.com/b", title: "OpenAI releases GPT-6 coding model for developers" }),
      item({ id: "c", url: "https://example.com/c", title: "Nvidia unveils a new robotics processor" }),
    ]);
    assert.deepEqual(clusters.map((cluster) => cluster.items.length).sort(), [1, 2]);
  });
});

describe("story scoring", () => {
  it("recognizes official evidence and keeps scores bounded", () => {
    const result = scoreCluster(
      [
        item({ source: "OpenAI", sourceKind: "official", domain: "openai.com" }),
        item({
          id: "hn-1",
          source: "Hacker News",
          sourceKind: "community",
          url: "https://news.ycombinator.com/item?id=1",
          domain: "news.ycombinator.com",
          engagement: { points: 300, comments: 90 },
        }),
      ],
      strongAssessment,
      now,
    );

    assert.equal(result.credibility, "official");
    assert.equal(result.signals.official, 10);
    assert.ok(result.trendScore >= 0 && result.trendScore <= 100);
    assert.ok(result.qualityScore >= 0 && result.qualityScore <= 100);
  });

  it("penalizes shallow, off-topic, recycled stories", () => {
    const weak = scoreCluster(
      [item()],
      { ...strongAssessment, isAiTech: false, viralButShallow: true, repostOfOldNews: true },
      now,
    );
    const strong = scoreCluster([item()], strongAssessment, now);
    assert.ok(weak.qualityScore < strong.qualityScore);
  });

  it("applies fact-check credibility adjustments", () => {
    assert.deepEqual(
      ["official", "reliable", "early", "unverified", "rumor", "conflicting"].map((status) =>
        credibilityAdjustment(status as Parameters<typeof credibilityAdjustment>[0]),
      ),
      [5, 2, -5, -15, -20, -12],
    );
  });
});
