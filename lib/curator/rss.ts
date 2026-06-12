import type { FeedSource, RawArticle } from "./types";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ITEMS_PER_FEED = 30;

/** RSS 2.0 / RSS 1.0 (RDF) / Atom を依存なしでパースする最小実装 */
export async function fetchFeed(source: FeedSource): Promise<RawArticle[]> {
  const res = await fetch(source.url, {
    headers: {
      "user-agent": "ai-news-curator/1.0 (personal feed reader)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`${source.id}: HTTP ${res.status}`);
  }
  const xml = await res.text();
  return parseFeed(xml, source).slice(0, MAX_ITEMS_PER_FEED);
}

export function parseFeed(xml: string, source: FeedSource): RawArticle[] {
  const items = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  const articles: RawArticle[] = [];
  for (const m of items) {
    const body = m[2];
    const title = cleanText(pickTag(body, ["title"]));
    const url = pickLink(body);
    if (!title || !url) continue;
    const dateStr = pickTag(body, ["pubDate", "published", "updated", "dc:date", "date"]);
    const publishedAt = parseDate(dateStr);
    const excerpt = cleanText(
      pickTag(body, ["description", "summary", "content", "content:encoded"]),
    ).slice(0, 500);
    articles.push({ title, url, sourceId: source.id, publishedAt, excerpt });
  }
  return articles;
}

function pickTag(xml: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(`<${escapeRe(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRe(name)}>`, "i");
    const m = xml.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function pickLink(xml: string): string {
  // Atom: <link rel="alternate" href="..."/> または rel なしの <link href="..."/>
  const atomLinks = [...xml.matchAll(/<link\b([^>]*)\/?>(?:<\/link>)?/gi)];
  for (const m of atomLinks) {
    const attrs = m[1];
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const rel = attrs.match(/rel=["']([^"']+)["']/i)?.[1];
    if (!rel || rel === "alternate") return decodeEntities(href);
  }
  // RSS: <link>https://...</link>
  const rssLink = xml.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)?.[1];
  if (rssLink?.trim()) return decodeEntities(stripCdata(rssLink).trim());
  return "";
}

function parseDate(raw: string): string {
  const t = Date.parse(stripCdata(raw).trim());
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function cleanText(s: string): string {
  return decodeEntities(stripCdata(s).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
