import { NextRequest, NextResponse } from "next/server";
import { requireApiShop } from "@/lib/dashboard/shop-context";
import {
  getEmailTemplateForShop,
  listEmailTemplatesForShop,
  renderEmailTemplatePreview,
  resetEmailTemplateForShop,
  saveEmailTemplateForShop,
} from "@/services/email/template-service";
import {
  isEmailTemplateKind,
  validateEditableEmailTemplate,
  type EmailTemplateKind,
} from "@/services/email/editable-templates";

function shopDisplayName(shop: { name: string | null; shopifyDomain: string }) {
  return shop.name ?? shop.shopifyDomain;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const kindParam = request.nextUrl.searchParams.get("kind");
  const shopName = shopDisplayName(auth.shop);

  if (kindParam) {
    if (!isEmailTemplateKind(kindParam)) {
      return NextResponse.json({ error: "Unknown template kind" }, { status: 400 });
    }
    const template = await getEmailTemplateForShop(
      auth.shop.id,
      kindParam,
      shopName,
    );
    return NextResponse.json({ template });
  }

  const templates = await listEmailTemplatesForShop(auth.shop.id, shopName);
  return NextResponse.json({ templates });
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      kind?: string;
      template?: Record<string, unknown>;
      previewOnly?: boolean;
    };

    if (!body.kind || !isEmailTemplateKind(body.kind)) {
      return NextResponse.json({ error: "Unknown template kind" }, { status: 400 });
    }

    const kind = body.kind as EmailTemplateKind;
    const shopName = shopDisplayName(auth.shop);

    if (body.previewOnly) {
      const validated = validateEditableEmailTemplate(body.template ?? {});
      const preview = renderEmailTemplatePreview({
        kind,
        template: validated,
        shopName,
      });
      return NextResponse.json({ preview, template: validated });
    }

    const saved = await saveEmailTemplateForShop(
      auth.shop.id,
      kind,
      body.template ?? {},
      shopName,
    );
    return NextResponse.json({ ok: true, template: saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiShop(request.nextUrl.searchParams.get("shop"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const kindParam = request.nextUrl.searchParams.get("kind");
    if (!kindParam || !isEmailTemplateKind(kindParam)) {
      return NextResponse.json({ error: "Unknown template kind" }, { status: 400 });
    }

    const template = await resetEmailTemplateForShop(
      auth.shop.id,
      kindParam,
      shopDisplayName(auth.shop),
    );
    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset failed" },
      { status: 400 },
    );
  }
}
