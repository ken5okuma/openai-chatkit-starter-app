"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CuratedArticle,
  DailyBatch,
  Preferences,
  Verdict,
} from "@/lib/curator/types";
import { TAG_LABELS } from "@/lib/curator/types";

interface TodayResponse {
  batch: DailyBatch;
  preferences: Preferences;
}

const SWIPE_THRESHOLD = 110;

export default function CuratorApp() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [deck, setDeck] = useState<CuratedArticle[]>([]);
  const [history, setHistory] = useState<{ article: CuratedArticle; verdict: Verdict }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [flying, setFlying] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/curator/today${refresh ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const json: TodayResponse = await res.json();
      setData(json);
      setDeck(json.batch.articles.filter((a) => !a.feedback));
      setHistory([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendFeedback = useCallback(async (articleId: string, verdict: Verdict | null) => {
    try {
      const res = await fetch("/api/curator/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleId, verdict }),
      });
      if (res.ok) {
        const json: TodayResponse = await res.json();
        setData((prev) => (prev ? { ...prev, preferences: json.preferences } : json));
      }
    } catch {
      // フィードバック送信失敗はUI継続を優先して握りつぶす
    }
  }, []);

  const swipe = useCallback(
    (verdict: Verdict) => {
      const top = deck[0];
      if (!top || flying) return;
      setFlying({ id: top.id, dir: verdict === "helpful" ? 1 : -1 });
      setDrag({ dx: 0, dy: 0, active: false });
      setTimeout(() => {
        setDeck((d) => d.slice(1));
        setHistory((h) => [...h, { article: { ...top, feedback: verdict }, verdict }]);
        setFlying(null);
      }, 220);
      setData((prev) =>
        prev
          ? {
              ...prev,
              batch: {
                ...prev.batch,
                articles: prev.batch.articles.map((a) =>
                  a.id === top.id ? { ...a, feedback: verdict } : a,
                ),
              },
            }
          : prev,
      );
      sendFeedback(top.id, verdict);
    },
    [deck, flying, sendFeedback],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || flying) return;
    setHistory((h) => h.slice(0, -1));
    setDeck((d) => [{ ...last.article, feedback: null }, ...d]);
    setData((prev) =>
      prev
        ? {
            ...prev,
            batch: {
              ...prev.batch,
              articles: prev.batch.articles.map((a) =>
                a.id === last.article.id ? { ...a, feedback: null } : a,
              ),
            },
          }
        : prev,
    );
    sendFeedback(last.article.id, null);
  }, [history, flying, sendFeedback]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") swipe("helpful");
      else if (e.key === "ArrowLeft") swipe("skip");
      else if (e.key === "u" || e.key === "Backspace") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe, undo]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (flying) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointerStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0, active: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    setDrag({
      dx: e.clientX - pointerStart.current.x,
      dy: e.clientY - pointerStart.current.y,
      active: true,
    });
  };
  const onPointerUp = () => {
    if (!pointerStart.current) return;
    const { dx } = drag;
    pointerStart.current = null;
    if (dx > SWIPE_THRESHOLD) swipe("helpful");
    else if (dx < -SWIPE_THRESHOLD) swipe("skip");
    else setDrag({ dx: 0, dy: 0, active: false });
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-32 text-slate-500 dark:text-slate-400">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500" />
          <p>今日のニュースを収集・選定しています…</p>
          <p className="text-xs">(初回はフィード巡回と要約のため1分ほどかかることがあります)</p>
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-32">
          <p className="text-rose-500">読み込みエラー: {error}</p>
          <button
            onClick={() => load()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-500"
          >
            再試行
          </button>
        </div>
      </Shell>
    );
  }

  const { batch, preferences } = data;
  const total = batch.articles.length;
  const done = total - deck.length;

  return (
    <Shell>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AIニュースキュレーター</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {batch.date} ・ {total}本(探索枠 {batch.articles.filter((a) => a.exploration).length}本)
            {batch.demo && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                デモデータ(フィード取得不可)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => load(true)}
            className="text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            title="フィードを再収集して選び直す"
          >
            再収集
          </button>
          <Link
            href="/chat"
            className="text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            チャット →
          </Link>
        </div>
      </header>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-300"
          style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
        />
      </div>

      {deck.length > 0 ? (
        <>
          <div className="relative mx-auto h-[440px] w-full max-w-md select-none">
            {deck
              .slice(0, 3)
              .map((article, i) => (
                <Card
                  key={article.id}
                  article={article}
                  depth={i}
                  drag={i === 0 ? drag : null}
                  flyingDir={flying?.id === article.id ? flying.dir : null}
                  onPointerDown={i === 0 ? onPointerDown : undefined}
                  onPointerMove={i === 0 ? onPointerMove : undefined}
                  onPointerUp={i === 0 ? onPointerUp : undefined}
                />
              ))
              .reverse()}
          </div>

          <div className="mt-6 flex items-center justify-center gap-6">
            <ActionButton label="不要" hint="←" onClick={() => swipe("skip")} variant="skip" />
            <ActionButton label="戻す" hint="U" onClick={undo} variant="undo" disabled={history.length === 0} />
            <ActionButton label="役に立った" hint="→" onClick={() => swipe("helpful")} variant="helpful" />
          </div>
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
            カードをスワイプ、またはキーボードの ← / → で評価。評価はタグとソースの重みに反映されます。
          </p>
        </>
      ) : (
        <Summary batch={batch} preferences={preferences} onRefresh={() => load(true)} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">{children}</div>
    </main>
  );
}

function Card({
  article,
  depth,
  drag,
  flyingDir,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  article: CuratedArticle;
  depth: number;
  drag: { dx: number; dy: number; active: boolean } | null;
  flyingDir: 1 | -1 | null;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: () => void;
}) {
  const dx = drag?.dx ?? 0;
  const dy = drag?.dy ?? 0;
  let transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx / 18}deg) scale(${1 - depth * 0.04}) translateY(${depth * 12}px)`;
  let transition = drag?.active ? "none" : "transform 0.25s ease, opacity 0.25s ease";
  let opacity = 1;
  if (flyingDir) {
    transform = `translate(${flyingDir * 560}px, ${dy * 0.3 - 40}px) rotate(${flyingDir * 24}deg)`;
    transition = "transform 0.22s ease-in, opacity 0.22s ease-in";
    opacity = 0;
  }

  return (
    <div
      className="absolute inset-0 touch-none rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ transform, transition, opacity, zIndex: 10 - depth, cursor: drag ? "grab" : "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {drag && dx > 30 && (
        <span className="absolute left-4 top-4 rotate-[-12deg] rounded border-2 border-emerald-500 px-2 py-1 text-sm font-bold text-emerald-500">
          役に立った
        </span>
      )}
      {drag && dx < -30 && (
        <span className="absolute right-4 top-4 rotate-[12deg] rounded border-2 border-rose-500 px-2 py-1 text-sm font-bold text-rose-500">
          不要
        </span>
      )}
      <div className="flex h-full flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-slate-500 dark:text-slate-400">{article.sourceName}</span>
          <span className="text-slate-300 dark:text-slate-600">・</span>
          <span className="text-slate-400 dark:text-slate-500">{timeAgo(article.publishedAt)}</span>
          {article.exploration && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
              探索枠
            </span>
          )}
        </div>
        <h2 className="mb-3 text-lg font-bold leading-snug">{article.title}</h2>
        <p className="flex-1 overflow-hidden text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {article.summary}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {article.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
              >
                {TAG_LABELS[t] ?? t}
              </span>
            ))}
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
            onPointerDown={(e) => e.stopPropagation()}
          >
            記事を読む ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  hint,
  onClick,
  variant,
  disabled,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  variant: "skip" | "undo" | "helpful";
  disabled?: boolean;
}) {
  const styles = {
    skip: "border-rose-300 text-rose-500 hover:bg-rose-50 dark:border-rose-700 dark:hover:bg-rose-950",
    undo: "border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-900",
    helpful:
      "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border-2 bg-white px-5 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-30 dark:bg-slate-900 ${styles[variant]}`}
    >
      {label} <span className="ml-1 text-xs font-normal opacity-60">{hint}</span>
    </button>
  );
}

function Summary({
  batch,
  preferences,
  onRefresh,
}: {
  batch: DailyBatch;
  preferences: Preferences;
  onRefresh: () => void;
}) {
  const helpful = batch.articles.filter((a) => a.feedback === "helpful");
  const skipped = batch.articles.filter((a) => a.feedback === "skip");
  const tagEntries = Object.entries(preferences.tagWeights).sort((a, b) => b[1] - a[1]);
  const sourceEntries = Object.entries(preferences.sourceWeights).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-1 text-lg font-bold">今日の評価が完了しました 🎉</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          役に立った {helpful.length}本 / 不要 {skipped.length}本。評価は明日以降の選定に反映されます。
        </p>
      </div>

      {helpful.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            役に立った記事
          </h3>
          <ul className="space-y-2">
            {helpful.map((a) => (
              <ArticleRow key={a.id} article={a} />
            ))}
          </ul>
        </section>
      )}

      {skipped.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-400 dark:text-slate-500">不要だった記事</h3>
          <ul className="space-y-2 opacity-60">
            {skipped.map((a) => (
              <ArticleRow key={a.id} article={a} />
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-bold">あなたの嗜好プロファイル(累計 {preferences.feedbackCount} 件の評価)</h3>
        {tagEntries.length === 0 ? (
          <p className="text-sm text-slate-400">まだ評価がありません。</p>
        ) : (
          <div className="space-y-4">
            <WeightBars title="タグの重み" entries={tagEntries} labels={TAG_LABELS} />
            <WeightBars title="ソースの重み" entries={sourceEntries} />
          </div>
        )}
      </section>

      <div className="flex justify-center">
        <button
          onClick={onRefresh}
          className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-sky-500"
        >
          フィードを再収集する
        </button>
      </div>
    </div>
  );
}

function ArticleRow({ article }: { article: CuratedArticle }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
      >
        {article.title}
      </a>
      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
        {article.sourceName} ・ {timeAgo(article.publishedAt)}
        {article.exploration && " ・ 探索枠"}
      </p>
    </li>
  );
}

function WeightBars({
  title,
  entries,
  labels,
}: {
  title: string;
  entries: [string, number][];
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <div className="space-y-1">
        {entries.map(([key, w]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-32 truncate text-slate-600 dark:text-slate-300">
              {labels?.[key] ?? key}
            </span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
              <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300 dark:bg-slate-600" />
              <div
                className={`absolute top-0 h-full rounded ${w >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
                style={{
                  left: w >= 0 ? "50%" : `${50 + (w / 2) * 50}%`,
                  width: `${(Math.abs(w) / 2) * 50}%`,
                }}
              />
            </div>
            <span className="w-10 text-right tabular-nums text-slate-400">{w.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "1時間以内";
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
