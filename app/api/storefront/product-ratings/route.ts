import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProxyShopDomain,
  verifyAppProxySignature,
} from "@/lib/shopify/app-proxy";
import { listProductCardRatings } from "@/services/storefront/product-ratings";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60, s-maxage=60",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/**
 * Batch ratings for product cards.
 * App proxy: GET /apps/outrage-reviews/product-ratings?ids=1,2&handles=a,b
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const params = request.nextUrl.searchParams;

  if (params.has("signature") && !verifyAppProxySignature(params)) {
    return NextResponse.json(
      { error: "Invalid proxy signature" },
      { status: 401, headers: corsHeaders(origin) },
    );
  }

  const shopDomain = normalizeProxyShopDomain(params.get("shop"));
  if (!shopDomain) {
    return NextResponse.json(
      { error: "shop is required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const ids = (params.get("ids") ?? params.get("product_ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const handles = (params.get("handles") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const products = await listProductCardRatings({
    shopDomain,
    productIds: ids,
    handles,
  });

  return NextResponse.json(
    { ok: true, products },
    { headers: corsHeaders(origin) },
  );
}
