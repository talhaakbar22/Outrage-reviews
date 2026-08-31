import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProxyShopDomain,
  verifyAppProxySignature,
} from "@/lib/shopify/app-proxy";
import { getShopByDomain } from "@/services/storefront/reviews";
import { buildCustomerSayPayload } from "@/services/reviews/customer-summary";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=120, s-maxage=120",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/**
 * Storefront "What customers say" widget feed.
 * App proxy: /apps/outrage-reviews/customer-say
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

  const reviewsOffset = Number(params.get("reviews_offset") ?? params.get("offset") ?? 0);
  const reviewsLimit = Number(params.get("reviews_limit") ?? params.get("limit") ?? 10);
  const includeReviews =
    params.get("include_reviews") === "true" ||
    params.get("expand") === "true" ||
    reviewsOffset > 0;

  const data = await buildCustomerSayPayload({
    shopId: shop.id,
    shopifyProductId: productId.replace(/\D/g, "") || productId,
    reviewsOffset: Number.isFinite(reviewsOffset) ? reviewsOffset : 0,
    reviewsLimit: Number.isFinite(reviewsLimit) ? reviewsLimit : 10,
    includeReviews,
  });

  return NextResponse.json(
    {
      ok: true,
      shop: shop.shopifyDomain,
      shopifyProductId: productId,
      ...data,
    },
    { headers: corsHeaders(origin) },
  );
}
