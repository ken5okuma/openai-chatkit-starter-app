import type { RawArticle } from "./types";
import { TAGS } from "./types";
import { isClaudeCliAvailable, runClaude } from "./claude";

export interface Annotation {
  tags: string[];
  summary: string;
}

const LLM_BATCH_SIZE = 20;

type Annotator = "claude" | "openai" | "heuristic";

/**
 * 記事にタグと日本語要約を付ける。バックエンドの優先順位:
 *   1. Claude Code CLI (claude -p) — Proプランのサブスク枠内で動く。APIキー不要
 *   2. OpenAI API — OPENAI_API_KEY がある場合のみ
 *   3. キーワードベースのフォールバック — LLMなしで動作
 * CURATOR_ANNOTATOR=claude|openai|heuristic で強制指定も可能。
 */
export async function annotateArticles(
  articles: RawArticle[],
): Promise<Map<string, Annotation>> {
  const result = new Map<string, Annotation>();
  for (const a of articles) {
    result.set(a.url, heuristicAnnotation(a));
  }

  const annotator = await pickAnnotator();
  if (annotator === "heuristic") return result;

  for (let i = 0; i < articles.length; i += LLM_BATCH_SIZE) {
    const batch = articles.slice(i, i + LLM_BATCH_SIZE);
    try {
      const annotated =
        annotator === "claude"
          ? await annotateWithClaude(batch)
          : await annotateWithOpenAi(batch);
      for (const [url, ann] of annotated) result.set(url, ann);
    } catch (err) {
      console.warn(`[curator] ${annotator} annotation failed, using heuristics:`, err);
      break;
    }
  }
  return result;
}

async function pickAnnotator(): Promise<Annotator> {
  const forced = process.env.CURATOR_ANNOTATOR;
  if (forced === "claude" || forced === "openai" || forced === "heuristic") {
    return forced;
  }
  if (await isClaudeCliAvailable()) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "heuristic";
}

function buildInstructions(): string {
  return [
    "あなたはAIニュースのキュレーターです。入力のJSON配列の各記事に以下を付与してください:",
    `- tags: ${TAGS.filter((t) => t !== "Other").join(", ")} から1〜2個(該当なしは Other)`,
    "- summary: 日本語で60〜90文字程度の要約(記事を読むか判断できる内容)",
    '出力はJSONのみ。説明文やコードフェンスは不要です: {"items":[{"id":0,"tags":["Models"],"summary":"..."}]}',
  ].join("\n");
}

function parseAnnotations(
  text: string,
  batch: RawArticle[],
): Map<string, Annotation> {
  // コードフェンスや前後の説明文が混ざっても最初のJSONオブジェクトを拾う
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("no JSON object in LLM output");
  const parsed = JSON.parse(jsonMatch[0]);
  const items: { id: number; tags?: string[]; summary?: string }[] = parsed.items ?? [];

  const map = new Map<string, Annotation>();
  for (const item of items) {
    const article = batch[item.id];
    if (!article) continue;
    const tags = (item.tags ?? []).filter((t): t is string =>
      (TAGS as readonly string[]).includes(t),
    );
    map.set(article.url, {
      tags: tags.length > 0 ? tags : ["Other"],
      summary: item.summary?.trim() || article.excerpt.slice(0, 120),
    });
  }
  return map;
}

function toPayload(batch: RawArticle[]): string {
  return JSON.stringify(
    batch.map((a, i) => ({ id: i, title: a.title, excerpt: a.excerpt.slice(0, 300) })),
  );
}

/** Claude Code CLI (headlessモード) で要約・タグ付け。Proプランのサブスク枠で動く */
async function annotateWithClaude(batch: RawArticle[]): Promise<Map<string, Annotation>> {
  const prompt = `${buildInstructions()}\n\n入力:\n${toPayload(batch)}`;
  const output = await runClaude(prompt);
  return parseAnnotations(output, batch);
}

const OPENAI_MODEL = process.env.CURATOR_MODEL || "gpt-5-mini";

async function annotateWithOpenAi(batch: RawArticle[]): Promise<Map<string, Annotation>> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: buildInstructions(),
      input: toPayload(batch),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return parseAnnotations(extractOutputText(data), batch);
}

function extractOutputText(data: unknown): string {
  const d = data as {
    output_text?: string;
    output?: { type: string; content?: { type: string; text?: string }[] }[];
  };
  if (typeof d.output_text === "string" && d.output_text) return d.output_text;
  for (const item of d.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && c.text) return c.text;
    }
  }
  throw new Error("no output_text in response");
}

const KEYWORDS: Record<string, RegExp> = {
  Models: /GPT|Claude|Gemini|Llama|Mistral|DeepSeek|新モデル|モデル(を|の)?(公開|発表|リリース)|foundation model|フロンティアモデル|LLM/i,
  Research: /論文|研究|arxiv|paper|study|benchmark|ベンチマーク|評価|学会|NeurIPS|ICML|ACL/i,
  Business: /資金調達|買収|提携|funding|raises?|acquisition|IPO|売上|億円|billion|投資|事業/i,
  Tools: /CLI|SDK|API|エージェント|agent|Copilot|Cursor|Codex|IDE|オープンソース|open[- ]?source|ツール|ライブラリ|フレームワーク/i,
  Infra: /GPU|NVIDIA|TPU|データセンター|チップ|半導体|推論基盤|inference|クラウド|サーバ/i,
  Policy: /規制|法案|safety|セーフティ|安全性|alignment|アライメント|著作権|ガバナンス|政府|EU AI/i,
  UseCase: /導入|活用|事例|業務|現場|採用した|adopts?|use case|実運用/i,
};

export function heuristicAnnotation(article: RawArticle): Annotation {
  const text = `${article.title} ${article.excerpt}`;
  const tags = Object.entries(KEYWORDS)
    .filter(([, re]) => re.test(text))
    .map(([tag]) => tag)
    .slice(0, 2);
  return {
    tags: tags.length > 0 ? tags : ["Other"],
    summary: article.excerpt.slice(0, 120) || article.title,
  };
}
