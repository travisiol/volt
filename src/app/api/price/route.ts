import { NextResponse } from "next/server";
import { getPrices } from "@/lib/pricing";
import type { PriceSymbol } from "@/types/price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN: PriceSymbol[] = ["TSLA", "ETH"];

/** GET /api/price?symbols=TSLA,ETH → { quotes: { TSLA: PriceQuote, ETH: PriceQuote }, at } */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wanted = (url.searchParams.get("symbols") ?? "TSLA,ETH")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is PriceSymbol => (KNOWN as string[]).includes(s));
  const quotes = await getPrices(wanted.length ? wanted : KNOWN);
  return NextResponse.json({ quotes, at: Date.now() }, { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" } });
}
