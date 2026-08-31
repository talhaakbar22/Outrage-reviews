import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { resolveStoredMediaPath } from "@/services/media/storage";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  const storageKey = segments.join("/");

  try {
    const absolutePath = resolveStoredMediaPath(storageKey);
    const file = await readFile(absolutePath);
    const extension = storageKey.split(".").pop()?.toLowerCase();

    const contentType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "gif"
            ? "image/gif"
            : extension === "avif"
              ? "image/avif"
              : "image/jpeg";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
