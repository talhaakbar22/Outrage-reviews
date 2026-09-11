import type {
  MerchantReplyEmailPayload,
  ReviewEmailPayload,
} from "@/services/email/types";

export const EMAIL_TEMPLATE_KINDS = [
  "request",
  "reminder",
  "photo_reminder",
  "thank_you",
  "merchant_reply",
] as const;

export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

export type EditableEmailTemplate = {
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
};

export type EmailTemplateVariable =
  | "shopName"
  | "productTitle"
  | "customerName"
  | "firstName"
  | "productUrl"
  | "reviewUrl";

export type TemplateVars = Record<EmailTemplateVariable, string>;

export type ShopBranding = {
  emailTemplates?: Partial<
    Record<EmailTemplateKind, Partial<EditableEmailTemplate>>
  >;
  [key: string]: unknown;
};

export const EMAIL_TEMPLATE_VARIABLES: {
  key: EmailTemplateVariable;
  label: string;
  description: string;
}[] = [
  { key: "shopName", label: "Shop name", description: "Your store name" },
  {
    key: "productTitle",
    label: "Product",
    description: "Product the customer bought or reviewed",
  },
  {
    key: "customerName",
    label: "Customer name",
    description: "Full customer name when available",
  },
  {
    key: "firstName",
    label: "First name",
    description: "Customer first name for greetings",
  },
  {
    key: "productUrl",
    label: "Product URL",
    description: "Public storefront product page",
  },
  {
    key: "reviewUrl",
    label: "Review URL",
    description: "Unique review request link (request emails)",
  },
];

const DEFAULTS: Record<EmailTemplateKind, EditableEmailTemplate> = {
  request: {
    subject: "How was your {{productTitle}}?",
    headline: "",
    body: "Thanks for shopping with {{shopName}}. How was your {{productTitle}}?",
    ctaLabel: "Write a review",
  },
  reminder: {
    subject: "Reminder: how was your {{productTitle}}?",
    headline: "",
    body: "Just a quick reminder from {{shopName}} — we'd still love your thoughts on {{productTitle}}.",
    ctaLabel: "Write a review",
  },
  photo_reminder: {
    subject: "Add a photo to your {{productTitle}} review?",
    headline: "",
    body: "Thanks again for reviewing {{productTitle}}. Photos and videos make reviews even more helpful — if you have a moment, we'd love to see yours.",
    ctaLabel: "Add a photo or video",
  },
  thank_you: {
    subject: "Thank you for your review of {{productTitle}}",
    headline: "Thank you for your review",
    body: "Thank you for taking the time to review {{productTitle}}. Your feedback helps other shoppers choose with confidence and means a lot to our team.",
    ctaLabel: "View product page",
  },
  merchant_reply: {
    subject: "{{shopName}} replied to your review of {{productTitle}}",
    headline: "They replied to your review",
    body: "{{shopName}} just responded about {{productTitle}}. Here's the full conversation.",
    ctaLabel: "View product page",
  },
};

export const UI_EMAIL_ID_TO_KIND: Record<string, EmailTemplateKind> = {
  request: "request",
  reminder: "reminder",
  photo: "photo_reminder",
  thanks: "thank_you",
  reply: "merchant_reply",
};

export function isEmailTemplateKind(value: string): value is EmailTemplateKind {
  return (EMAIL_TEMPLATE_KINDS as readonly string[]).includes(value);
}

export function getDefaultEmailTemplate(
  kind: EmailTemplateKind,
): EditableEmailTemplate {
  return { ...DEFAULTS[kind] };
}

export function parseShopBranding(value: unknown): ShopBranding {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as ShopBranding;
}

export function getStoredEmailTemplate(
  branding: unknown,
  kind: EmailTemplateKind,
): Partial<EditableEmailTemplate> | null {
  const parsed = parseShopBranding(branding);
  const stored = parsed.emailTemplates?.[kind];
  if (!stored || typeof stored !== "object") return null;
  return stored;
}

export function resolveEmailTemplate(
  kind: EmailTemplateKind,
  branding: unknown,
): EditableEmailTemplate {
  const defaults = getDefaultEmailTemplate(kind);
  const stored = getStoredEmailTemplate(branding, kind);
  if (!stored) return defaults;

  return {
    subject: cleanField(stored.subject, defaults.subject, 200),
    headline: cleanField(stored.headline, defaults.headline, 120),
    body: cleanField(stored.body, defaults.body, 4000),
    ctaLabel: cleanField(stored.ctaLabel, defaults.ctaLabel, 80),
  };
}

function cleanField(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function validateEditableEmailTemplate(
  input: Partial<EditableEmailTemplate>,
): EditableEmailTemplate {
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const headline =
    typeof input.headline === "string" ? input.headline.trim() : "";
  const ctaLabel =
    typeof input.ctaLabel === "string" ? input.ctaLabel.trim() : "";

  if (!subject) {
    throw new Error("Subject is required.");
  }
  if (!body) {
    throw new Error("Email body is required.");
  }
  if (subject.length > 200) {
    throw new Error("Subject must be 200 characters or fewer.");
  }
  if (body.length > 4000) {
    throw new Error("Body must be 4000 characters or fewer.");
  }
  if (headline.length > 120) {
    throw new Error("Headline must be 120 characters or fewer.");
  }
  if (ctaLabel.length > 80) {
    throw new Error("Button label must be 80 characters or fewer.");
  }

  return {
    subject,
    headline,
    body,
    ctaLabel: ctaLabel || "Continue",
  };
}

export function mergeEmailTemplateIntoBranding(
  existing: unknown,
  kind: EmailTemplateKind,
  template: EditableEmailTemplate | null,
): ShopBranding {
  const branding = { ...parseShopBranding(existing) };
  const emailTemplates = { ...(branding.emailTemplates ?? {}) };

  if (template === null) {
    delete emailTemplates[kind];
  } else {
    emailTemplates[kind] = {
      subject: template.subject,
      headline: template.headline,
      body: template.body,
      ctaLabel: template.ctaLabel,
    };
  }

  branding.emailTemplates = emailTemplates;
  return branding;
}

export function interpolateTemplate(
  template: string,
  vars: Partial<TemplateVars>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key as EmailTemplateVariable];
    return value == null ? "" : String(value);
  });
}

export function buildTemplateVarsFromReviewPayload(
  payload: ReviewEmailPayload,
): TemplateVars {
  const customerName = payload.customerName?.trim() || "";
  const firstName = customerName.split(/\s+/)[0] || customerName || "there";
  return {
    shopName: payload.shopName,
    productTitle: payload.productTitle,
    customerName: customerName || "there",
    firstName,
    productUrl: payload.productUrl || payload.reviewUrl || "",
    reviewUrl: payload.reviewUrl || payload.productUrl || "",
  };
}

export function buildTemplateVarsFromReplyPayload(
  payload: MerchantReplyEmailPayload,
): TemplateVars {
  const customerName = payload.customerName?.trim() || "";
  const firstName = customerName.split(/\s+/)[0] || customerName || "there";
  return {
    shopName: payload.shopName,
    productTitle: payload.productTitle,
    customerName: customerName || "there",
    firstName,
    productUrl: payload.productUrl || "",
    reviewUrl: payload.productUrl || "",
  };
}

export function sampleTemplateVars(shopName = "Your Store"): TemplateVars {
  return {
    shopName,
    productTitle: "The Multi-managed Snowboard",
    customerName: "Alex Customer",
    firstName: "Alex",
    productUrl: "https://example.myshopify.com/products/the-multi-managed-snowboard",
    reviewUrl:
      "https://example.com/review/sample-token-for-preview",
  };
}

export function emailTemplateMeta(kind: EmailTemplateKind) {
  switch (kind) {
    case "request":
      return {
        title: "Review request",
        description:
          "Ask customers to leave a review after their order is delivered.",
      };
    case "reminder":
      return {
        title: "Review request reminder",
        description:
          "Follow up with customers who have not submitted a review yet.",
      };
    case "photo_reminder":
      return {
        title: "Photo/video reminder",
        description:
          "Encourage customers who left a text review to add a photo or video.",
      };
    case "thank_you":
      return {
        title: "Thank you email",
        description: "Thank customers after they submit a product review.",
      };
    case "merchant_reply":
      return {
        title: "Review reply email",
        description:
          "Notify customers when you reply to their review, with the full conversation.",
      };
  }
}
