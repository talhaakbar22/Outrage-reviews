import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProxyShopDomain,
  verifyAppProxySignature,
} from "@/lib/shopify/app-proxy";
import { env } from "@/lib/env";

/**
 * App proxy: /apps/outrage-reviews/write-review?product_id=…
 * Redirects to the hosted write-review page for the product.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.has("signature") && !verifyAppProxySignature(params)) {
    return NextResponse.json({ error: "Invalid proxy signature" }, { status: 401 });
  }

  const shopDomain = normalizeProxyShopDomain(params.get("shop"));
  const productId = params.get("product_id") ?? params.get("productId");

  if (!shopDomain || !productId) {
    return NextResponse.json(
      { error: "shop and product_id are required" },
      { status: 400 },
    );
  }

  const destination = new URL("/write-review", env.appUrl());
  destination.searchParams.set("shop", shopDomain);
  destination.searchParams.set("product_id", productId);

  return NextResponse.redirect(destination);
}
