# Voice Translator PWA

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![NextJS](https://img.shields.io/badge/Built_with-NextJS-blue)
![OpenAI API](https://img.shields.io/badge/Powered_by-gpt--realtime--translate-orange)

OpenAI の `gpt-realtime-translate`（2026年5月リリース）を使った、スマホ向けリアルタイム音声翻訳 PWA。
日本語で小声で話すと、選んだ言語の音声がスピーカーから再生されます。

## 主な機能

- **70+ 入力言語 → 13 出力言語** の双方向リアルタイム翻訳（英・西・葡・仏・独・伊・露・中・韓・印・尼・越・日）
- **WebRTC で直接ブラウザから OpenAI に接続**（サーバーは短命なクライアントシークレットを発行するのみ）
- **小声入力 → 大音量出力**：WebAudio の `GainNode` で出力音量を 1〜5 倍に調整可能
- **30秒無音で自動切断**：マイクの RMS を `AnalyserNode` で監視し、課金事故を防止
- **PWA インストール対応**：iOS / Android のホーム画面に追加、`manifest.webmanifest` と Service Worker 同梱
- **入出力字幕のリアルタイム表示**（`session.input_transcript.delta` / `session.output_transcript.delta`）

## アーキテクチャ

```
[ Mic ] ──getUserMedia──▶ [ RTCPeerConnection ] ──SDP──▶ api.openai.com/v1/realtime/translations/calls
                                  │                                  │
                                  │                                  └─ 翻訳音声track + data channel events
                                  ▼
                          [ AudioContext ]
                                  │
                          [ GainNode (×1-5) ]
                                  │
                                  ▼
                            [ Speaker ]

[ Browser ] ─POST─▶ /api/translate-session ─POST─▶ api.openai.com/v1/realtime/translations/client_secrets
                                                            │
                                                            └─ 短命な client_secret を返却
```

API キーはサーバー側 (`app/api/translate-session/route.ts`) で保持し、ブラウザには短命な `client_secret` のみ渡します。

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. 環境変数

```bash
cp .env.example .env.local
```

`.env.local` に [OpenAI API Keys](https://platform.openai.com/api-keys) で発行した API キーを設定：

```
OPENAI_API_KEY=sk-proj-...
```

### 3. 起動

```bash
npm run dev
```

`http://localhost:3000` を開いて翻訳開始ボタンを押すと、マイク許可後に WebRTC セッションが確立します。

> **注**: `getUserMedia` は HTTPS または `localhost` でのみ動作します。スマホ実機で試す場合は HTTPS 化されたドメインへデプロイしてください。

### 4. PWA としてインストール

- iOS Safari: 共有 → 「ホーム画面に追加」
- Android Chrome: メニュー → 「アプリをインストール」

Service Worker は本番ビルドでのみ登録されます (`components/RegisterSW.tsx`)。

### 5. デプロイ

```bash
npm run build
npm run start
```

Vercel など HTTPS 対応のホスティングへデプロイ可能。マイクと WebRTC を使うため HTTPS は必須です。

## 料金（参考、2026年5月時点）

- `gpt-realtime-translate`: **$0.034 / 分**
- `gpt-realtime-whisper`（入力文字起こし）: **$0.017 / 分**

30秒無音で自動切断する仕組みにより、置きっぱなしによる課金事故を防いでいます。

## 設定をカスタマイズしたいとき

- 出力言語リスト: [`lib/languages.ts`](lib/languages.ts)
- 無音検出のしきい値・タイムアウト: [`components/Translator.tsx`](components/Translator.tsx) の `SILENCE_*` 定数
- セッション設定（モデル・ノイズリダクション等）: [`app/api/translate-session/route.ts`](app/api/translate-session/route.ts)

## 参考リンク

- [Advancing voice intelligence with new models in the API (OpenAI, 2026-05-07)](https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/)
- [Realtime translation guide (OpenAI)](https://developers.openai.com/api/docs/guides/realtime-translation)
- [Cookbook: Build Live Translation Apps with gpt-realtime-translate](https://developers.openai.com/cookbook/examples/voice_solutions/realtime_translation_guide)
- [gpt-realtime-translate model card](https://developers.openai.com/api/docs/models/gpt-realtime-translate)
