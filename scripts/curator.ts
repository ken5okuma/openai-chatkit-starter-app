/**
 * チャット(Claude Code)から操作するためのCLI版キュレーター。
 *
 *   npx tsx scripts/curator.ts today [--refresh]   今日の12本を表示(なければ収集)
 *   npx tsx scripts/curator.ts feedback 1,3 helpful 番号で評価(helpful | skip | clear)
 *   npx tsx scripts/curator.ts prefs                嗜好プロファイルを表示
 */
import { getTodayBatch, applyFeedback } from "../lib/curator/curator";
import { loadBatch, loadPreferences, todayJst } from "../lib/curator/store";
import { TAG_LABELS, type CuratedArticle, type Preferences } from "../lib/curator/types";

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "today": {
      const refresh = args.includes("--refresh");
      const { batch } = await getTodayBatch(refresh);
      printBatch(batch.articles, batch.date, batch.demo);
      break;
    }
    case "feedback": {
      const [numbers, verdictArg] = args;
      if (!numbers || !["helpful", "skip", "clear"].includes(verdictArg)) {
        fail("使い方: feedback <番号(カンマ区切り)> <helpful|skip|clear>");
      }
      const batch = await loadBatch(todayJst());
      if (!batch) fail("今日のバッチがありません。先に today を実行してください。");
      const verdict = verdictArg === "clear" ? null : (verdictArg as "helpful" | "skip");
      let prefs: Preferences | null = null;
      for (const n of numbers.split(",").map((s) => parseInt(s.trim(), 10))) {
        const article = batch!.articles[n - 1];
        if (!article) fail(`番号 ${n} の記事がありません(1〜${batch!.articles.length})`);
        const result = await applyFeedback(article!.id, verdict);
        prefs = result.preferences;
        console.log(`${n}. ${verdictLabel(verdict)} ${article!.title}`);
      }
      if (prefs) printPrefs(prefs);
      break;
    }
    case "prefs": {
      printPrefs(await loadPreferences());
      break;
    }
    default:
      fail("使い方: today [--refresh] | feedback <番号> <helpful|skip|clear> | prefs");
  }
}

function printBatch(articles: CuratedArticle[], date: string, demo: boolean) {
  console.log(`# 今日のAIニュース ${date}${demo ? " ⚠️ デモデータ(フィード取得不可)" : ""}\n`);
  articles.forEach((a, i) => {
    const mark = a.feedback === "helpful" ? "✅" : a.feedback === "skip" ? "❌" : "⬜";
    const tags = a.tags.map((t) => TAG_LABELS[t] ?? t).join("・");
    console.log(`${i + 1}. ${mark} ${a.title}${a.exploration ? "(探索枠)" : ""}`);
    console.log(`   ${a.sourceName} | ${tags}`);
    console.log(`   ${a.summary}`);
    console.log(`   ${a.url}\n`);
  });
  const rated = articles.filter((a) => a.feedback).length;
  console.log(`評価済み: ${rated}/${articles.length}`);
}

function printPrefs(prefs: Preferences) {
  console.log(`\n## 嗜好プロファイル(累計 ${prefs.feedbackCount} 件)`);
  const tags = Object.entries(prefs.tagWeights).sort((a, b) => b[1] - a[1]);
  for (const [tag, w] of tags) {
    console.log(`  ${bar(w)} ${(TAG_LABELS[tag] ?? tag).padEnd(6, "　")} ${w.toFixed(2)}`);
  }
  const sources = Object.entries(prefs.sourceWeights).sort((a, b) => b[1] - a[1]);
  for (const [src, w] of sources) {
    console.log(`  ${bar(w)} ${src} ${w.toFixed(2)}`);
  }
}

function bar(w: number): string {
  const n = Math.round(Math.abs(w) * 5);
  return (w >= 0 ? "+" : "-").repeat(Math.max(1, Math.min(n, 10))).padEnd(10);
}

function verdictLabel(v: "helpful" | "skip" | null): string {
  return v === "helpful" ? "✅ 役に立った" : v === "skip" ? "❌ 不要" : "⬜ 取り消し";
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
