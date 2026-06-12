import { createHash } from "node:crypto";
import type { CuratedArticle, DailyBatch, Preferences, RawArticle, Verdict } from "./types";
import { SOURCES, getSource } from "./sources";
import { fetchFeed } from "./rss";
import { annotateArticles } from "./tagging";
import { applyFeedbackToPrefs, scoreArticle, selectDaily } from "./scoring";
import {
  appendFeedbackLog,
  loadBatch,
  loadPreferences,
  saveBatch,
  savePreferences,
  todayJst,
} from "./store";
import { sampleArticles } from "./sample";

const MAX_AGE_DAYS = 7;
const ANNOTATE_LIMIT = 60;

/** 今日のバッチを返す。なければ収集して作る(= Daily job 相当)。 */
export async function getTodayBatch(refresh = false): Promise<{
  batch: DailyBatch;
  preferences: Preferences;
}> {
  const date = todayJst();
  const preferences = await loadPreferences();
  if (!refresh) {
    const existing = await loadBatch(date);
    if (existing) return { batch: existing, preferences };
  }
  const batch = await buildBatch(date, preferences);
  await saveBatch(batch);
  return { batch, preferences };
}

async function buildBatch(date: string, prefs: Preferences): Promise<DailyBatch> {
  const results = await Promise.allSettled(SOURCES.map((s) => fetchFeed(s)));
  const raw: RawArticle[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      raw.push(...r.value);
    } else {
      console.warn(`[curator] feed failed: ${SOURCES[i].id}:`, r.reason?.message ?? r.reason);
    }
  });

  const demo = raw.length === 0;
  const candidates = demo ? sampleArticles() : filterAndDedupe(raw);

  // タグ嗜好を加える前の素点(新着性+信頼度)で足切りしてからLLMに渡す
  const preScored = candidates
    .map((a) => ({
      article: a,
      pre: scoreArticle({ ...a, tags: [] }, { ...prefs, tagWeights: {}, sourceWeights: {} }),
    }))
    .sort((x, y) => y.pre - x.pre)
    .slice(0, ANNOTATE_LIMIT)
    .map((x) => x.article);

  const annotations = await annotateArticles(preScored);

  const curated: CuratedArticle[] = preScored.map((a) => {
    const ann = annotations.get(a.url)!;
    const article = {
      ...a,
      id: createHash("sha1").update(a.url).digest("hex").slice(0, 12),
      sourceName: getSource(a.sourceId)?.name ?? a.sourceId,
      tags: ann.tags,
      summary: ann.summary,
      exploration: false,
      score: 0,
    };
    return { ...article, score: round(scoreArticle(article, prefs)) };
  });

  return {
    date,
    generatedAt: new Date().toISOString(),
    articles: selectDaily(curated),
    demo,
  };
}

function filterAndDedupe(raw: RawArticle[]): RawArticle[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 3_600_000;
  const seen = new Set<string>();
  const out: RawArticle[] = [];
  for (const a of raw) {
    if (Date.parse(a.publishedAt) < cutoff) continue;
    const key = a.url.replace(/[?#].*$/, "");
    const titleKey = a.title.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key) || seen.has(titleKey)) continue;
    seen.add(key);
    seen.add(titleKey);
    out.push(a);
  }
  return out;
}

/**
 * スワイプのフィードバックを記録し、タグ・ソースの重みを更新する。
 * verdict=null は取り消し(直前の評価の影響を巻き戻す)。
 */
export async function applyFeedback(
  articleId: string,
  verdict: Verdict | null,
): Promise<{ batch: DailyBatch; preferences: Preferences }> {
  const date = todayJst();
  const batch = await loadBatch(date);
  if (!batch) throw new Error("today's batch not found");
  const article = batch.articles.find((a) => a.id === articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);

  let prefs = await loadPreferences();

  // 既存の評価があればまず巻き戻す(再評価・取り消しの両方に対応)
  if (article.feedback) {
    prefs = applyFeedbackToPrefs(prefs, article, article.feedback === "helpful" ? -1 : 1);
    prefs.feedbackCount -= 1;
  }
  if (verdict) {
    prefs = applyFeedbackToPrefs(prefs, article, verdict === "helpful" ? 1 : -1);
    prefs.feedbackCount += 1;
  }

  article.feedback = verdict;
  await Promise.all([
    saveBatch(batch),
    savePreferences(prefs),
    appendFeedbackLog({ date, articleId, verdict, at: new Date().toISOString() }),
  ]);
  return { batch, preferences: prefs };
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
