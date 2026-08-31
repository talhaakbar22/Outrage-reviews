import { NextRequest, NextResponse } from "next/server";
import { normalizeShopDomain } from "@/lib/shopify/auth";
import { enqueueLooxImport } from "@/lib/queue";
import { createLooxImportJob } from "@/services/import/loox/runner";
import { saveImportCsv } from "@/services/media";
import { getDb } from "@/lib/prisma";
import { loadOfflineSession } from "@/services/shop/service";

export async function POST(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  if (!shopParam) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopDomain = normalizeShopDomain(shopParam);
  const session = await loadOfflineSession(shopDomain);

  if (!session?.accessToken || !session.isActive(undefined)) {
    return NextResponse.json({ error: "Shop is not connected" }, { status: 401 });
  }

  const db = getDb();
  const shop = await db.orm.public.Shop.where({ shopifyDomain: shopDomain }).first();
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
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

  const { job } = await createLooxImportJob(shop.id, csvContent);
  const csvPath = await saveImportCsv(job.id, csvContent);

  await enqueueLooxImport({
    shopId: shop.id,
    syncJobId: job.id,
    csvPath,
  });

  return NextResponse.json({
    ok: true,
    syncJobId: job.id,
    message: "Loox import queued. Review images will be downloaded to your storage.",
  });
}

export async function GET(request: NextRequest) {
  const syncJobId = request.nextUrl.searchParams.get("syncJobId");
  if (!syncJobId) {
    return NextResponse.json({ error: "Missing syncJobId" }, { status: 400 });
  }

  const db = getDb();
  const job = await db.orm.public.SyncJob.where({ id: syncJobId }).first();

  if (!job) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    type: job.type,
    payload: job.payload,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
}
