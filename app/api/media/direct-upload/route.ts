import { NextRequest, NextResponse } from "next/server";
import {
  putObjectBuffer,
  verifyMediaUploadSignature,
} from "@/services/media/object-storage";

export const runtime = "nodejs";

/**
 * Browser → Firebase Storage upload proxy.
 * Used when MEDIA_UPLOAD_VIA_PROXY=true or against the Storage emulator
 * (signed GCS URLs need a real service account).
 */
export async function PUT(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const contentType =
    request.nextUrl.searchParams.get("contentType") ||
    request.headers.get("content-type") ||
    "";
  const expiresAt = Number(request.nextUrl.searchParams.get("expiresAt") || 0);
  const signature = request.nextUrl.searchParams.get("signature") || "";

  if (!key || !contentType || !signature) {
    return NextResponse.json({ error: "Invalid upload parameters" }, { status: 400 });
  }

  if (
    !verifyMediaUploadSignature({
      key,
      contentType,
      expiresAt,
      signature,
    })
  ) {
    return NextResponse.json({ error: "Upload URL expired or invalid" }, { status: 403 });
  }

  if (!key.startsWith("review-media/") || key.includes("..")) {
    return NextResponse.json({ error: "Invalid media key" }, { status: 400 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0) {
    return NextResponse.json({ error: "Empty upload body" }, { status: 400 });
  }

  await putObjectBuffer({
    key,
    body,
    contentType,
  });

  return new NextResponse(null, { status: 204 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
