import { getShopSettings, updateShopSettingsBranding } from "@/services/dashboard/data";
import {
  EMAIL_TEMPLATE_KINDS,
  EMAIL_TEMPLATE_VARIABLES,
  emailTemplateMeta,
  getDefaultEmailTemplate,
  getStoredEmailTemplate,
  isEmailTemplateKind,
  mergeEmailTemplateIntoBranding,
  resolveEmailTemplate,
  sampleTemplateVars,
  validateEditableEmailTemplate,
  type EditableEmailTemplate,
  type EmailTemplateKind,
} from "@/services/email/editable-templates";
import {
  buildMerchantReplyEmail,
  buildReviewEmail,
  buildThankYouEmail,
} from "@/services/email/templates";
import type {
  MerchantReplyEmailPayload,
  ReviewEmailPayload,
} from "@/services/email/types";

export async function listEmailTemplatesForShop(shopId: string, shopName: string) {
  const settings = await getShopSettings(shopId);
  const branding = settings.branding;

  return EMAIL_TEMPLATE_KINDS.map((kind) => {
    const defaults = getDefaultEmailTemplate(kind);
    const stored = getStoredEmailTemplate(branding, kind);
    const resolved = resolveEmailTemplate(kind, branding);
    const meta = emailTemplateMeta(kind);
    const preview = renderEmailTemplatePreview({
      kind,
      template: resolved,
      shopName,
    });

    return {
      kind,
      title: meta.title,
      description: meta.description,
      isCustomized: Boolean(stored),
      defaults,
      template: resolved,
      variables: EMAIL_TEMPLATE_VARIABLES,
      preview,
    };
  });
}

export async function getEmailTemplateForShop(
  shopId: string,
  kind: EmailTemplateKind,
  shopName: string,
) {
  if (!isEmailTemplateKind(kind)) {
    throw new Error("Unknown email template kind.");
  }

  const settings = await getShopSettings(shopId);
  const defaults = getDefaultEmailTemplate(kind);
  const stored = getStoredEmailTemplate(settings.branding, kind);
  const resolved = resolveEmailTemplate(kind, settings.branding);
  const meta = emailTemplateMeta(kind);
  const preview = renderEmailTemplatePreview({
    kind,
    template: resolved,
    shopName,
  });

  return {
    kind,
    title: meta.title,
    description: meta.description,
    isCustomized: Boolean(stored),
    defaults,
    template: resolved,
    variables: EMAIL_TEMPLATE_VARIABLES,
    preview,
  };
}

export async function saveEmailTemplateForShop(
  shopId: string,
  kind: EmailTemplateKind,
  input: Partial<EditableEmailTemplate>,
  shopName: string,
) {
  if (!isEmailTemplateKind(kind)) {
    throw new Error("Unknown email template kind.");
  }

  const validated = validateEditableEmailTemplate(input);
  const settings = await getShopSettings(shopId);
  const branding = mergeEmailTemplateIntoBranding(
    settings.branding,
    kind,
    validated,
  );
  await updateShopSettingsBranding(shopId, branding);
  return getEmailTemplateForShop(shopId, kind, shopName);
}

export async function resetEmailTemplateForShop(
  shopId: string,
  kind: EmailTemplateKind,
  shopName: string,
) {
  if (!isEmailTemplateKind(kind)) {
    throw new Error("Unknown email template kind.");
  }

  const settings = await getShopSettings(shopId);
  const branding = mergeEmailTemplateIntoBranding(
    settings.branding,
    kind,
    null,
  );
  await updateShopSettingsBranding(shopId, branding);
  return getEmailTemplateForShop(shopId, kind, shopName);
}

export function renderEmailTemplatePreview(input: {
  kind: EmailTemplateKind;
  template: EditableEmailTemplate;
  shopName: string;
}) {
  const vars = sampleTemplateVars(input.shopName);
  const productUrl = vars.productUrl;
  const productImageUrl =
    "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";

  if (input.kind === "thank_you") {
    const payload: ReviewEmailPayload = {
      to: "preview@example.com",
      shopName: vars.shopName,
      productTitle: vars.productTitle,
      customerName: vars.customerName,
      reviewUrl: productUrl,
      productUrl,
      productImageUrl,
      kind: "thank_you",
    };
    return buildThankYouEmail(payload, input.template);
  }

  if (input.kind === "merchant_reply") {
    const payload: MerchantReplyEmailPayload = {
      to: "preview@example.com",
      shopName: vars.shopName,
      shopDomain: "example.myshopify.com",
      productTitle: vars.productTitle,
      productUrl,
      productImageUrl,
      customerName: vars.customerName,
      conversation: [
        {
          role: "customer",
          authorName: vars.customerName,
          body: "Great quality and fast shipping. Would buy again!",
          rating: 5,
          sentAt: "Sep 10, 2026",
        },
        {
          role: "store",
          authorName: vars.shopName,
          body: "Thank you so much for the kind review — we’re thrilled you love it!",
          sentAt: "Sep 11, 2026",
        },
      ],
    };
    return buildMerchantReplyEmail(payload, input.template);
  }

  const kind =
    input.kind === "reminder"
      ? "reminder"
      : input.kind === "photo_reminder"
        ? "photo_reminder"
        : "request";

  const payload: ReviewEmailPayload = {
    to: "preview@example.com",
    shopName: vars.shopName,
    productTitle: vars.productTitle,
    customerName: vars.customerName,
    reviewUrl: vars.reviewUrl,
    productUrl,
    kind,
  };
  return buildReviewEmail(payload, input.template);
}

export async function resolveShopEmailTemplate(
  shopId: string,
  kind: EmailTemplateKind,
) {
  const settings = await getShopSettings(shopId);
  return resolveEmailTemplate(kind, settings.branding);
}
