import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import { buildShopReviewsCsv } from "@/services/reviews/export";

export async function GET(request: NextRequest) {
  const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { csv, count } = await buildShopReviewsCsv(auth.shop.id);
  const stamp = new Date().toISOString().slice(0, 10);
  const domain = auth.shop.shopifyDomain.replace(/\.myshopify\.com$/i, "");
  const filename = `${domain}-reviews-${stamp}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Review-Count": String(count),
    },
  });
}
