import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import { listShopProducts } from "@/services/dashboard/data";

export async function GET(request: NextRequest) {
  const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const products = await listShopProducts(auth.shop.id);
  return NextResponse.json({ products });
}
