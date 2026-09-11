import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import {
  buildAdvocatesCsv,
  listReferralAdvocates,
} from "@/services/referrals/settings";

export async function GET(request: NextRequest) {
  const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const advocates = await listReferralAdvocates(auth.shop.id);
  const csv = buildAdvocatesCsv(advocates);
  const domain = auth.shop.shopifyDomain.replace(/\.myshopify\.com$/i, "");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${domain}-referral-advocates-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Advocate-Count": String(advocates.length),
    },
  });
}
