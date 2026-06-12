import type { RawArticle } from "./types";

/**
 * フィード取得に全滅した場合(オフライン環境など)に使うサンプル記事。
 * 内容は架空のもので、UIとフィードバックループの動作確認用。
 */
export function sampleArticles(now = Date.now()): RawArticle[] {
  const h = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  return [
    {
      title: "【サンプル】次世代マルチモーダルモデルが発表、長文動画の理解が大幅向上",
      url: "https://example.com/sample/multimodal-model",
      sourceId: "openai-news",
      publishedAt: h(3),
      excerpt:
        "新しいフラッグシップモデルが発表された。動画・音声・テキストを統合的に扱い、1時間超の動画からの質問応答精度が前世代比で大きく改善したという。",
    },
    {
      title: "【サンプル】LLMの推論コストを1/4にする量子化手法の論文が公開",
      url: "https://example.com/sample/quantization-paper",
      sourceId: "arxiv-cs-ai",
      publishedAt: h(7),
      excerpt:
        "精度劣化をほぼ抑えたまま4bit量子化を実現する新手法。主要ベンチマークでFP16との差は1%未満と報告されている。",
    },
    {
      title: "【サンプル】国内大手銀行が全行員にAIアシスタントを導入、文書作成時間を3割削減",
      url: "https://example.com/sample/bank-ai-assistant",
      sourceId: "itmedia-aiplus",
      publishedAt: h(10),
      excerpt:
        "稟議書や顧客向け資料の下書きにLLMを活用。半年のパイロット運用で文書作成時間が平均30%減ったとして全社展開を決めた。",
    },
    {
      title: "【サンプル】AIスタートアップが大型資金調達、評価額は1兆円規模に",
      url: "https://example.com/sample/funding-round",
      sourceId: "hn-ai",
      publishedAt: h(14),
      excerpt:
        "エージェント基盤を開発するスタートアップがシリーズDで大型調達。調達資金はデータセンター確保と研究人材の採用に充てるという。",
    },
    {
      title: "【サンプル】コーディングエージェントCLIに並列実行機能、複数タスクの同時処理が可能に",
      url: "https://example.com/sample/coding-agent-parallel",
      sourceId: "publickey",
      publishedAt: h(18),
      excerpt:
        "ターミナルから使うコーディングエージェントがアップデート。ワークツリーを分離して複数の修正タスクを並列に走らせられるようになった。",
    },
    {
      title: "【サンプル】EUのAI規制、汎用モデルの透明性義務が来月から適用開始",
      url: "https://example.com/sample/eu-ai-act",
      sourceId: "hatena-it",
      publishedAt: h(22),
      excerpt:
        "学習データの概要開示や評価結果の報告が義務化される。国内企業でも欧州向けにサービス提供する場合は対応が必要となる。",
    },
    {
      title: "【サンプル】新型AIアクセラレータが出荷開始、推論性能は前世代の2.5倍",
      url: "https://example.com/sample/ai-accelerator",
      sourceId: "hn-ai",
      publishedAt: h(26),
      excerpt:
        "メモリ帯域の改善により大規模モデルの推論スループットが大幅向上。クラウド各社が年内の提供開始を予告している。",
    },
    {
      title: "【サンプル】RAGの検索精度を上げる「クエリ分解」の実践テクニック",
      url: "https://example.com/sample/rag-query-decomposition",
      sourceId: "zenn-llm",
      publishedAt: h(30),
      excerpt:
        "複合的な質問を sub-query に分解してから検索するパターンの実装例。評価データの作り方と失敗例も含めて解説する。",
    },
    {
      title: "【サンプル】オープンソースの音声合成モデルが日本語対応、商用利用も可能",
      url: "https://example.com/sample/oss-tts-japanese",
      sourceId: "huggingface-blog",
      publishedAt: h(34),
      excerpt:
        "数秒のサンプル音声から話者の特徴を再現できるTTSモデルが日本語に対応。ライセンスは商用利用可能な形で公開された。",
    },
    {
      title: "【サンプル】LLMエージェントの長期記憶に関するサーベイ論文が話題に",
      url: "https://example.com/sample/memory-survey",
      sourceId: "arxiv-cs-ai",
      publishedAt: h(40),
      excerpt:
        "エピソード記憶・意味記憶・手続き記憶の分類でエージェントの記憶機構を整理。今後の研究課題として評価手法の標準化を挙げる。",
    },
    {
      title: "【サンプル】製造業の現場点検にマルチモーダルAI、異常検知の見逃しを半減",
      url: "https://example.com/sample/factory-inspection",
      sourceId: "itmedia-aiplus",
      publishedAt: h(45),
      excerpt:
        "画像と点検記録テキストを組み合わせて異常兆候を検出。熟練者の暗黙知をプロンプトに落とし込む工夫が紹介されている。",
    },
    {
      title: "【サンプル】ブラウザ操作エージェントのベンチマークで新記録、成功率は8割超",
      url: "https://example.com/sample/browser-agent-benchmark",
      sourceId: "google-research",
      publishedAt: h(50),
      excerpt:
        "実在のWebサイトを模した環境でのタスク成功率が初めて80%を突破。フォーム入力や複数タブの操作が改善のポイントだという。",
    },
    {
      title: "【サンプル】社内ドキュメント検索ボットを1日で作る:埋め込みモデル選定の勘所",
      url: "https://example.com/sample/internal-search-bot",
      sourceId: "zenn-ai",
      publishedAt: h(55),
      excerpt:
        "日本語ドキュメントに強い埋め込みモデルの比較と、チャンク分割・リランキングの設定例。小規模チームでの運用ノウハウも。",
    },
    {
      title: "【サンプル】AIの電力需要が急増、データセンター向け電力契約が前年比3倍に",
      url: "https://example.com/sample/power-demand",
      sourceId: "hatena-it",
      publishedAt: h(60),
      excerpt:
        "生成AIの普及でデータセンターの電力確保が課題に。再エネ調達や原子力の長期契約など各社の対応をまとめた。",
    },
    {
      title: "【サンプル】プロンプトインジェクション対策の設計パターン集が公開",
      url: "https://example.com/sample/prompt-injection-patterns",
      sourceId: "publickey",
      publishedAt: h(64),
      excerpt:
        "外部コンテンツを扱うLLMアプリ向けに、権限分離・出力検証・ツール呼び出し制限などの防御パターンを体系化したガイド。",
    },
    {
      title: "【サンプル】小型モデルの蒸留レシピを公開、7Bで70B級の日本語性能を主張",
      url: "https://example.com/sample/distillation-recipe",
      sourceId: "huggingface-blog",
      publishedAt: h(70),
      excerpt:
        "合成データの生成からフィルタリング、二段階蒸留までの手順を全公開。日本語ベンチマークでの評価結果も添付されている。",
    },
  ];
}
