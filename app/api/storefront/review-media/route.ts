import { NextRequest, NextResponse } from "next/server";
import {
  normalizeProxyShopDomain,
  verifyAppProxySignature,
} from "@/lib/shopify/app-proxy";
import { createWidgetUploadPermission } from "@/services/media/presign";
import { getShopByDomain } from "@/services/storefront/reviews";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/**
 * App proxy: POST /apps/outrage-reviews/review-media
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const params = request.nextUrl.searchParams;

  if (params.has("signature") && !verifyAppProxySignature(params)) {
    return NextResponse.json(
      { error: "Invalid proxy signature" },
      { status: 401, headers: corsHeaders(origin) },
    );
  }

  try {
    const body = await request.json();
    const shopDomain = normalizeProxyShopDomain(
      params.get("shop") ?? (typeof body.shop === "string" ? body.shop : null),
    );
    const uploadSessionId =
      typeof body.upload_session_id === "string" ? body.upload_session_id : "";
    const contentType =
      typeof body.contentType === "string" ? body.contentType : "";
    const contentLength = Number(body.contentLength);
    const sortOrder = Number(body.sortOrder ?? 0);

    if (!shopDomain || !uploadSessionId) {
      return NextResponse.json(
        { error: "shop and upload_session_id are required" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    if (!contentType) {
      return NextResponse.json(
        { error: "Missing content type" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    if (!Number.isFinite(contentLength) || contentLength < 1) {
      return NextResponse.json(
        { error: "Invalid content length" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 4) {
      return NextResponse.json(
        { error: "Invalid sort order" },
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

    const upload = await createWidgetUploadPermission({
      shopId: shop.id,
      uploadSessionId,
      contentType,
      contentLength,
    });

    return NextResponse.json(
      {
        ok: true,
        mediaKey: upload.mediaKey,
        uploadUrl: upload.uploadUrl,
        publicUrl: upload.publicUrl,
        headers: upload.headers,
        mediaType: upload.mediaType,
        sortOrder,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload permission failed",
      },
      { status: 400, headers: corsHeaders(origin) },
    );
  }
}
