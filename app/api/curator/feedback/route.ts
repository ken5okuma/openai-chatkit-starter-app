import { NextRequest, NextResponse } from "next/server";
import { applyFeedback } from "@/lib/curator/curator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const articleId: unknown = body.articleId;
    const verdict: unknown = body.verdict;
    if (typeof articleId !== "string" || !articleId) {
      return NextResponse.json({ error: "articleId is required" }, { status: 400 });
    }
    if (verdict !== "helpful" && verdict !== "skip" && verdict !== null) {
      return NextResponse.json(
        { error: 'verdict must be "helpful", "skip", or null' },
        { status: 400 },
      );
    }
    const result = await applyFeedback(articleId, verdict);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[curator] feedback failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
