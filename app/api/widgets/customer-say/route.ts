import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import {
  buildCustomerSayPayload,
  emptyPayload,
  listPreviewProducts,
} from "@/services/reviews/customer-summary";

export async function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const auth = await requireApiShop(shopParam);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const productId =
    request.nextUrl.searchParams.get("product_id") ??
    request.nextUrl.searchParams.get("productId");
  const mode = request.nextUrl.searchParams.get("mode");

  if (mode === "products") {
    const products = await listPreviewProducts(auth.shop.id);
    return NextResponse.json({
      ok: true,
      products: products.map((product) => ({
        id: product.id,
        title: product.title,
        shopifyProductId: product.shopifyProductId,
        reviewCount: product.reviewCount,
        avgRating: product.avgRating,
        imageUrl: product.imageUrl,
      })),
    });
  }

  if (!productId) {
    const products = await listPreviewProducts(auth.shop.id, 1);
    const fallback = products[0];
    if (!fallback) {
      return NextResponse.json({
        ok: true,
        ...emptyPayload(0, 10, {
          summaryText:
            "Sync products and collect reviews to preview this widget.",
        }),
      });
    }

    const data = await buildCustomerSayPayload({
      shopId: auth.shop.id,
      shopifyProductId: fallback.shopifyProductId,
      includeReviews: request.nextUrl.searchParams.get("expand") === "true",
      reviewsOffset: Number(request.nextUrl.searchParams.get("offset") ?? 0),
      reviewsLimit: Number(request.nextUrl.searchParams.get("limit") ?? 10),
    });

    return NextResponse.json({ ok: true, ...data });
  }

  const data = await buildCustomerSayPayload({
    shopId: auth.shop.id,
    shopifyProductId: productId.replace(/\D/g, "") || productId,
    includeReviews: request.nextUrl.searchParams.get("expand") === "true",
    reviewsOffset: Number(request.nextUrl.searchParams.get("offset") ?? 0),
    reviewsLimit: Number(request.nextUrl.searchParams.get("limit") ?? 10),
  });

  return NextResponse.json({ ok: true, ...data });
}
