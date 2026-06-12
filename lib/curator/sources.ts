import type { FeedSource } from "./types";

/**
 * 巡回する情報源。trust はスコアリングの「ソース信頼度」項。
 * 好みに合わせて自由に追加・削除してよい。
 */
export const SOURCES: FeedSource[] = [
  {
    id: "openai-news",
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    trust: 0.9,
    lang: "en",
  },
  {
    id: "huggingface-blog",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    trust: 0.8,
    lang: "en",
  },
  {
    id: "google-research",
    name: "Google Research Blog",
    url: "https://research.google/blog/rss/",
    trust: 0.8,
    lang: "en",
  },
  {
    id: "arxiv-cs-ai",
    name: "arXiv cs.AI",
    url: "https://rss.arxiv.org/rss/cs.AI",
    trust: 0.7,
    lang: "en",
  },
  {
    id: "hn-ai",
    name: "Hacker News (AI)",
    url: "https://hnrss.org/newest?q=LLM+OR+AI&points=50",
    trust: 0.6,
    lang: "en",
  },
  {
    id: "itmedia-aiplus",
    name: "ITmedia AI+",
    url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
    trust: 0.7,
    lang: "ja",
  },
  {
    id: "publickey",
    name: "Publickey",
    url: "https://www.publickey1.jp/atom.xml",
    trust: 0.7,
    lang: "ja",
  },
  {
    id: "zenn-ai",
    name: "Zenn (AI)",
    url: "https://zenn.dev/topics/ai/feed",
    trust: 0.6,
    lang: "ja",
  },
  {
    id: "zenn-llm",
    name: "Zenn (LLM)",
    url: "https://zenn.dev/topics/llm/feed",
    trust: 0.6,
    lang: "ja",
  },
  {
    id: "hatena-it",
    name: "はてなブックマーク (IT)",
    url: "https://b.hatena.ne.jp/hotentry/it.rss",
    trust: 0.5,
    lang: "ja",
  },
];

export function getSource(id: string): FeedSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
