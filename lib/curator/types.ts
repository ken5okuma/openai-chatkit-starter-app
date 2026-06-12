export type Verdict = "helpful" | "skip";

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  /** 0..1 の信頼度。スコアリングの「ソース信頼度」項に使う */
  trust: number;
  lang: "ja" | "en";
}

export interface RawArticle {
  title: string;
  url: string;
  sourceId: string;
  publishedAt: string; // ISO 8601
  excerpt: string;
}

export interface CuratedArticle extends RawArticle {
  id: string;
  sourceName: string;
  tags: string[];
  summary: string;
  score: number;
  /** 探索枠(スコア上位以外から意図的に混ぜた記事)かどうか */
  exploration: boolean;
  feedback?: Verdict | null;
}

export interface DailyBatch {
  date: string; // YYYY-MM-DD (JST)
  generatedAt: string;
  articles: CuratedArticle[];
  /** フィード取得に全滅した場合のサンプルデータかどうか */
  demo: boolean;
}

export interface Preferences {
  tagWeights: Record<string, number>;
  sourceWeights: Record<string, number>;
  feedbackCount: number;
  updatedAt: string;
}

export const TAGS = [
  "Models",
  "Research",
  "Business",
  "Tools",
  "Infra",
  "Policy",
  "UseCase",
  "Other",
] as const;

export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<string, string> = {
  Models: "モデル",
  Research: "研究",
  Business: "ビジネス",
  Tools: "開発ツール",
  Infra: "インフラ",
  Policy: "政策・安全性",
  UseCase: "活用事例",
  Other: "その他",
};

export const TOTAL_PER_DAY = 12;
export const EXPLORATION_SLOTS = 2;
