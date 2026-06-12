import type { CuratedArticle, Preferences } from "./types";
import { EXPLORATION_SLOTS, TOTAL_PER_DAY } from "./types";
import { getSource } from "./sources";

export const WEIGHT_MIN = -2;
export const WEIGHT_MAX = 2;
export const TAG_DELTA = 0.2;
export const SOURCE_DELTA = 0.15;

/**
 * score = 新着性 + ソース信頼度 + タグ嗜好 + ソース嗜好
 */
export function scoreArticle(
  article: Pick<CuratedArticle, "publishedAt" | "sourceId" | "tags">,
  prefs: Preferences,
  now = Date.now(),
): number {
  const ageHours = Math.max(0, (now - Date.parse(article.publishedAt)) / 3_600_000);
  const recency = Math.exp(-ageHours / 36); // 36時間で約1/e

  const trust = getSource(article.sourceId)?.trust ?? 0.5;

  const tagWeights = article.tags.map((t) => prefs.tagWeights[t] ?? 0);
  const tagPref =
    tagWeights.length > 0
      ? tagWeights.reduce((a, b) => a + b, 0) / tagWeights.length / WEIGHT_MAX
      : 0; // -1..1

  const sourcePref = (prefs.sourceWeights[article.sourceId] ?? 0) / WEIGHT_MAX; // -1..1

  return 1.0 * recency + 0.8 * trust + 1.0 * tagPref + 0.6 * sourcePref;
}

/**
 * スコア上位 (TOTAL - EXPLORATION) 本 + 探索枠 EXPLORATION 本を選ぶ。
 * 探索枠は上位選定から漏れた記事のうち、上位に出ていないタグを優先してランダムに選ぶ。
 */
export function selectDaily(articles: CuratedArticle[]): CuratedArticle[] {
  const sorted = [...articles].sort((a, b) => b.score - a.score);
  const topCount = Math.min(TOTAL_PER_DAY - EXPLORATION_SLOTS, sorted.length);
  const top = sorted.slice(0, topCount);
  const rest = sorted.slice(topCount);

  const topTags = new Set(top.flatMap((a) => a.tags));
  const novel = rest.filter((a) => a.tags.some((t) => !topTags.has(t)));
  const pool = novel.length >= EXPLORATION_SLOTS ? novel : rest;

  const exploration = shuffle(pool)
    .slice(0, EXPLORATION_SLOTS)
    .map((a) => ({ ...a, exploration: true }));

  return shuffle([...top, ...exploration]);
}

export function applyFeedbackToPrefs(
  prefs: Preferences,
  article: Pick<CuratedArticle, "tags" | "sourceId">,
  direction: 1 | -1,
): Preferences {
  const tagWeights = { ...prefs.tagWeights };
  for (const tag of article.tags) {
    tagWeights[tag] = clamp((tagWeights[tag] ?? 0) + direction * TAG_DELTA);
  }
  const sourceWeights = { ...prefs.sourceWeights };
  sourceWeights[article.sourceId] = clamp(
    (sourceWeights[article.sourceId] ?? 0) + direction * SOURCE_DELTA,
  );
  return {
    tagWeights,
    sourceWeights,
    feedbackCount: prefs.feedbackCount,
    updatedAt: new Date().toISOString(),
  };
}

function clamp(v: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(v * 100) / 100));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
