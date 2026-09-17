import { NextRequest, NextResponse } from "next/server";
import { normalizeShopDomain } from "@/lib/shopify/auth";
import { createShopifySyncService } from "@/lib/shopify/sync";
import { getDb } from "@/lib/prisma";
import { importProductsFromCsv } from "@/services/import/products/runner";
import { loadOfflineSession } from "@/services/shop/service";

async function requireShop(shopParam: string | null) {
  if (!shopParam) {
    return { error: NextResponse.json({ error: "Missing shop parameter" }, { status: 400 }) };
  }

  const shopDomain = normalizeShopDomain(shopParam);
  const session = await loadOfflineSession(shopDomain);

  if (!session?.accessToken || !session.isActive(undefined)) {
    return {
      error: NextResponse.json({ error: "Shop is not connected" }, { status: 401 }),
    };
  }

  const db = getDb();
  const shop = await db.orm.public.Shop.where({ shopifyDomain: shopDomain }).first();
  if (!shop) {
    return { error: NextResponse.json({ error: "Shop not found" }, { status: 404 }) };
  }

  return { shop, session, shopDomain };
}

/**
 * POST /api/import/products?shop=...
 * - multipart CSV upload (default)
 * - OR JSON { "mode": "shopify" } to sync products from the connected store
 */
export async function POST(request: NextRequest) {
  const auth = await requireShop(request.nextUrl.searchParams.get("shop"));
  if ("error" in auth) return auth.error;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { mode?: string };
    if (body.mode !== "shopify") {
      return NextResponse.json(
        { error: 'Send { "mode": "shopify" } or upload a CSV file' },
        { status: 400 },
      );
    }

    try {
      const result = await createShopifySyncService(auth.session).runProductsSync(
        auth.shop.id,
      );
      return NextResponse.json({
        ok: true,
        source: "shopify",
        ...result,
        message: `Synced ${result.productsSynced} products from Shopify.`,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Shopify product sync failed",
        },
        { status: 500 },
      );
    }
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing CSV file upload" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Upload must be a .csv file" }, { status: 400 });
  }

  const csvContent = await file.text();
  if (!csvContent.trim()) {
    return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
  }

  try {
    const result = await importProductsFromCsv({
      shopId: auth.shop.id,
      csvContent,
    });

    return NextResponse.json({
      ok: true,
      source: "csv",
      ...result,
      message: `Imported products from CSV. Created ${result.created}, updated ${result.updated}, failed ${result.failedRows}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Product CSV import failed",
      },
      { status: 500 },
    );
  }
}
