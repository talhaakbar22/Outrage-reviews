import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import { listCollectReviewRequests } from "@/services/reviews/collect";

export async function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const auth = await requireApiShop(shopParam);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const rows = await listCollectReviewRequests(auth.shop.id, { search });

  return NextResponse.json({ ok: true, requests: rows });
}
