import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProxyShopDomain,
  verifyAppProxySignature,
} from "@/lib/shopify/app-proxy";
import {
  getShopByDomain,
  listPublishedReviewsForShopifyProduct,
} from "@/services/storefront/reviews";

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
 * Public storefront reviews feed.
 * Supports:
 * - App Proxy: /apps/outrage-reviews/reviews → /api/storefront/reviews?...&signature=
 * - Direct:    /api/storefront/reviews?shop=...&product_id=...
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const params = request.nextUrl.searchParams;
  const hasSignature = params.has("signature");

  if (hasSignature && !verifyAppProxySignature(params)) {
    return NextResponse.json(
      { error: "Invalid proxy signature" },
      { status: 401, headers: corsHeaders(origin) },
    );
  }

  const shopDomain = normalizeProxyShopDomain(params.get("shop"));
  const productId = params.get("product_id") ?? params.get("productId");

  if (!shopDomain || !productId) {
    return NextResponse.json(
      { error: "shop and product_id are required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const shop = await getShopByDomain(shopDomain);
  if (!shop || shop.uninstalledAt) {
    return NextResponse.json(
      { error: "Shop not found" },
      { status: 404, headers: corsHeaders(origin) },
    );
  }

  const limit = Number(params.get("limit") ?? 20);
  const offset = Number(params.get("offset") ?? 0);

  const data = await listPublishedReviewsForShopifyProduct({
    shopId: shop.id,
    shopifyProductId: productId.replace(/\D/g, "") || productId,
    limit: Number.isFinite(limit) ? limit : 20,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json(
    {
      ok: true,
      shop: shop.shopifyDomain,
      productId,
      rating: data.rating,
      count: data.count,
      ratingBreakdown: data.ratingBreakdown,
      reviews: data.reviews,
    },
    { headers: corsHeaders(origin) },
  );
}
