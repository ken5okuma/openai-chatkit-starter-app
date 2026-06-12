# AIニュースキュレーター (+ ChatKit Starter)

[Zennの記事「自分専用のAIニュースキュレーターをCodexで作って約1か月運用してみた」](https://zenn.dev/mkj/articles/966c62588bd8fc) を参考に実装した、自分専用のAIニュースキュレーターです。トップページ (`/`) がキュレーター、元のChatKitチャットは `/chat` に残っています。

## 仕組み

1. **収集 (Daily job)** — AI関連のRSS/Atomフィード([`lib/curator/sources.ts`](lib/curator/sources.ts))を巡回し、直近7日の記事を集めます。アプリを開いた日に1回だけ自動実行され、結果は `data/curator/daily/YYYY-MM-DD.json` にキャッシュされます。
2. **要約・タグ付け** — 日本語要約と分類タグ(モデル/研究/ビジネス/開発ツール/インフラ/政策・安全性/活用事例)をLLMが付与します。バックエンドは自動選択:
   1. **Claude Code CLI**(`claude -p` のheadlessモード)— **Claude Pro/Maxプランのサブスク枠内で動くためAPIキー・追加費用は不要**。`claude` コマンドがインストール済み(かつ `claude login` 済み)なら自動で使われます。`CURATOR_CLAUDE_MODEL=haiku` を設定すると軽量モデルで利用枠を節約できます。
   2. OpenAI API — `OPENAI_API_KEY` がある場合のみ(既定: `gpt-5-mini`、`CURATOR_MODEL` で変更可)
   3. キーワードベースのフォールバック — LLMなしでも動作

   `CURATOR_ANNOTATOR=claude|openai|heuristic` で明示的に固定することもできます。
3. **スコアリング** — `score = 新着性 + ソース信頼度 + タグ嗜好 + ソース嗜好` で各記事を採点します([`lib/curator/scoring.ts`](lib/curator/scoring.ts))。
4. **1日12本を選定、うち2本は探索枠** — スコア上位だけだと好みに偏るため、上位10本に加えて、上位に出ていないタグの記事から2本をランダムに混ぜます。
5. **スワイプでフィードバック** — Tinder風のカードUIで右スワイプ「役に立った」/ 左スワイプ「不要」。評価するとその記事のタグとソースの重みが更新され(±0.2 / ±0.15、範囲は -2〜+2)、翌日以降の選定に反映されます。嗜好プロファイルは `data/curator/preferences.json` に保存されます。

### 使い方

- カードをドラッグしてスワイプ、またはキーボードの `←`(不要)/ `→`(役に立った)/ `U`(戻す)
- 全カード評価後に、今日の結果と嗜好プロファイル(タグ・ソースの重み)が表示されます
- ヘッダーの「再収集」でフィードを取り直して選定し直せます

### iPhone(Claude Codeアプリ)での使い方

スマホではWeb UIの代わりに、**Claude Codeのチャットから操作**できます。iPhoneのClaudeアプリ → Claude Code → このリポジトリでセッションを開始し、こう話しかけるだけです:

> 「今日のニュース見せて」 → 12本が番号付きで表示される
> 「1と3は役に立った、2は不要」 → 評価が記録され、嗜好プロファイルが更新される

操作手順は [`CLAUDE.md`](CLAUDE.md) に書いてあるため、セッション内のClaudeが自動でスクリプト実行・コミット・プッシュまで行います。評価データは `data/curator/` としてGitHubに保存されるので、**使い捨てのクラウドセッションでも学習が引き継がれ、PCのWeb UIとも同期されます**。

> ⚠️ セットアップ: Claude Codeのクラウド環境のネットワーク設定で、RSSフィードのドメインへのアクセスを許可してください(設定 → 環境 → Network access を「Allow all」にするのが簡単です)。許可がないとデモデータが表示されます。

CLIを直接使う場合:

```bash
npx tsx scripts/curator.ts today              # 今日の12本を表示(なければ収集)
npx tsx scripts/curator.ts feedback 1,3 helpful  # 番号で評価(helpful/skip/clear)
npx tsx scripts/curator.ts prefs              # 嗜好プロファイルを表示
```

### 毎日の自動収集(オプション)

元記事ではCodexのオートメーションで毎日のジョブを回しています。このアプリは初回アクセス時に自動収集しますが、cronで事前に温めておくこともできます:

```cron
0 7 * * * curl -s "http://localhost:3000/api/curator/today" > /dev/null
```

> ネットワークが遮断された環境などでフィードが1件も取れない場合は、動作確認用のサンプル記事(デモデータ)が表示されます。

---

# ChatKit Starter Template

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![NextJS](https://img.shields.io/badge/Built_with-NextJS-blue)
![OpenAI API](https://img.shields.io/badge/Powered_by-OpenAI_API-orange)

This repository is the simplest way to bootstrap a [ChatKit](http://openai.github.io/chatkit-js/) application. It ships with a minimal Next.js UI, the ChatKit web component, and a ready-to-use session endpoint so you can experiment with OpenAI-hosted workflows built using [Agent Builder](https://platform.openai.com/agent-builder).

## What You Get

- Next.js app with `<openai-chatkit>` web component and theming controls
- API endpoint for creating a session at [`app/api/create-session/route.ts`](app/api/create-session/route.ts)
- Config file for starter prompts, theme, placeholder text, and greeting message

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

Copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

You can get your workflow id from the [Agent Builder](https://platform.openai.com/agent-builder) interface, after clicking "Publish":

<img src="./public/docs/workflow.jpg" width=500 />

You can get your OpenAI API key from the [OpenAI API Keys](https://platform.openai.com/api-keys) page.

### 3. Configure ChatKit credentials

Update `.env.local` with the variables that match your setup.

- `OPENAI_API_KEY` — API key created **within the same org & project as your Agent Builder**
- `NEXT_PUBLIC_CHATKIT_WORKFLOW_ID` — the workflow you created in [Agent Builder](https://platform.openai.com/agent-builder)
- (optional) `CHATKIT_API_BASE` - customizable base URL for the ChatKit API endpoint

> Note: if your workflow is using a model requiring organization verification, such as GPT-5, make sure you verify your organization first. Visit your [organization settings](https://platform.openai.com/settings/organization/general) and click on "Verify Organization".

### 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` and start chatting. Use the prompts on the start screen to verify your workflow connection, then customize the UI or prompt list in [`lib/config.ts`](lib/config.ts) and [`components/ChatKitPanel.tsx`](components/ChatKitPanel.tsx).

### 5. Deploy your app

```bash
npm run build
```

Before deploying your app, you need to verify the domain by adding it to the [Domain allowlist](https://platform.openai.com/settings/organization/security/domain-allowlist) on your dashboard.

## Customization Tips

- Adjust starter prompts, greeting text, [chatkit theme](https://chatkit.studio/playground), and placeholder copy in [`lib/config.ts`](lib/config.ts).
- Update the event handlers inside [`components/.tsx`](components/ChatKitPanel.tsx) to integrate with your product analytics or storage.

## References

- [ChatKit JavaScript Library](http://openai.github.io/chatkit-js/)
- [Advanced Self-Hosting Examples](https://github.com/openai/openai-chatkit-advanced-samples)
