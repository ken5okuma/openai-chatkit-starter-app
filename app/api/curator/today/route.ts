import { NextRequest, NextResponse } from "next/server";
import { getTodayBatch } from "@/lib/curator/curator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const result = await getTodayBatch(refresh);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[curator] today failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
