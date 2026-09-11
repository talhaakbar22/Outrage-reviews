import {
  getShopSettings,
  updateShopSettingsBranding,
} from "@/services/dashboard/data";
import type { ShopBranding } from "@/services/email/editable-templates";

export type DiscountUnit = "percent" | "fixed";

export type ReferralEmailKind =
  | "onsite"
  | "post_review"
  | "post_purchase"
  | "advocate_reward_paid";

export type ReferralEmailTemplate = {
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
};

export type ReferralWidgetId =
  | "onsite_popup"
  | "onsite_sidebar"
  | "post_purchase"
  | "post_purchase_legacy"
  | "post_review";

export type ReferralSettings = {
  offer: {
    friendDiscountType: DiscountUnit;
    friendDiscountValue: number;
    rewardAdvocates: boolean;
    advocateRewardValue: number;
    limitRewardedOrders: boolean;
    limitRewardedOrdersCount: number;
    minimumPurchaseAmount: number;
    combineProductDiscounts: boolean;
    combineOrderDiscounts: boolean;
    combineShippingDiscounts: boolean;
  };
  widgets: Record<
    ReferralWidgetId,
    {
      active: boolean;
    }
  >;
  emails: Record<ReferralEmailKind, ReferralEmailTemplate>;
  preferences: {
    preventAdvocateSelfRewards: boolean;
    redeemDelayEnabled: boolean;
    limitDiscountsToNewCustomers: boolean;
    preventSelfReferrals: boolean;
    socialMediaImageUrl: string | null;
    socialMediaShareText: string;
    syncAdvocatesToShopify: boolean;
    marketingConsentType: "no_consent" | "opt_in" | "opt_out";
    marketingConsentText: string;
  };
};

export type ReferralAdvocate = {
  id: string;
  email: string;
  name: string | null;
  code: string;
  source: "onsite" | "post_review" | "post_purchase";
  rewardCount: number;
  createdAt: string;
  marketingConsent: boolean;
};

const DEFAULT_EMAILS: Record<ReferralEmailKind, ReferralEmailTemplate> = {
  onsite: {
    subject: "Share {{shopName}} with friends — Give {{friendOffer}}, Get {{advocateOffer}}",
    headline: "Your referral link is ready",
    body: "Thanks for joining the {{shopName}} referral program. Share your personal link with friends so they can enjoy {{friendOffer}} off, and you’ll earn {{advocateOffer}} when they purchase.",
    ctaLabel: "Share my link",
  },
  post_review: {
    subject: "Loved {{productTitle}}? Share {{friendOffer}} with a friend",
    headline: "Turn your review into a gift",
    body: "Thank you for reviewing {{productTitle}}. Share your referral link so friends can get {{friendOffer}} off their first order — and you earn {{advocateOffer}} when they buy.",
    ctaLabel: "Share my referral link",
  },
  post_purchase: {
    subject: "Give {{friendOffer}}, get {{advocateOffer}} from {{shopName}}",
    headline: "Invite your friends",
    body: "Thanks for shopping with {{shopName}}. Share your personal referral link so friends can save {{friendOffer}} on their first purchase, and you’ll earn {{advocateOffer}} for every successful referral.",
    ctaLabel: "Get my referral link",
  },
  advocate_reward_paid: {
    subject: "You’ve earned {{advocateOffer}} from {{shopName}}",
    headline: "Your referral reward is ready",
    body: "Great news — a friend used your referral link at {{shopName}}. Your {{advocateOffer}} reward is ready to use on your next order.",
    ctaLabel: "Shop now",
  },
};

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  offer: {
    friendDiscountType: "percent",
    friendDiscountValue: 15,
    rewardAdvocates: false,
    advocateRewardValue: 2,
    limitRewardedOrders: true,
    limitRewardedOrdersCount: 10,
    minimumPurchaseAmount: 40,
    combineProductDiscounts: false,
    combineOrderDiscounts: false,
    combineShippingDiscounts: false,
  },
  widgets: {
    onsite_popup: { active: false },
    onsite_sidebar: { active: false },
    post_purchase: { active: false },
    post_purchase_legacy: { active: false },
    post_review: { active: false },
  },
  emails: DEFAULT_EMAILS,
  preferences: {
    preventAdvocateSelfRewards: false,
    redeemDelayEnabled: true,
    limitDiscountsToNewCustomers: false,
    preventSelfReferrals: false,
    socialMediaImageUrl: null,
    socialMediaShareText:
      "Get {{friendOffer}} off using my discount code. Use my personal link to get a discount off your first purchase at {{shopName}}.",
    syncAdvocatesToShopify: false,
    marketingConsentType: "no_consent",
    marketingConsentText: "Email me with updates, news and offers.",
  },
};

export const REFERRAL_WIDGET_CATALOG: Array<{
  id: ReferralWidgetId;
  title: string;
  description: string;
  badge?: "New" | "Legacy";
  previewLabel: string;
}> = [
  {
    id: "onsite_popup",
    title: "Onsite Referrals Widget",
    description:
      "Encourage customers and visitors to become brand advocates by signing up and receiving referral links to share with friends and family.",
    previewLabel: "Give {{friend}}%, Get reward",
  },
  {
    id: "onsite_sidebar",
    title: "Onsite Referrals Sidebar",
    description:
      "A subtle sidebar tab that provides easy access to your Onsite Referrals Widget from any page of your store.",
    previewLabel: "Referrals",
  },
  {
    id: "post_purchase",
    title: "Post-Purchase Referrals Widget",
    description:
      "Add this widget to your Thank you and Order status pages through the checkout editor to turn customers into brand advocates.",
    badge: "New",
    previewLabel: "Give 10%, Get reward",
  },
  {
    id: "post_purchase_legacy",
    title: "Post-Purchase Referrals Widget",
    description:
      "Turn customers into brand advocates by offering them referral links to share right after they make a purchase.",
    badge: "Legacy",
    previewLabel: "Give Your Friends a Gift!",
  },
  {
    id: "post_review",
    title: "Post-Review Referrals Widget",
    description:
      "Turn your happiest customers into brand advocates by inviting them to share referral links after leaving a positive review.",
    previewLabel: "Share after review",
  },
];

export const REFERRAL_EMAIL_CATALOG: Array<{
  id: ReferralEmailKind;
  title: string;
  description: string;
}> = [
  {
    id: "onsite",
    title: "Onsite Referrals",
    description:
      "Sent to advocates who sign up through the Onsite Referrals Widget, asking them to share their referral link.",
  },
  {
    id: "post_review",
    title: "Post-Review Referrals",
    description:
      "Sent to advocates who sign up through the Post-Review Referrals Widget, asking them to share their referral link.",
  },
  {
    id: "post_purchase",
    title: "Post-Purchase Referrals",
    description:
      "Sent to advocates who sign up through the Post-Purchase Referrals Widget, asking them to share their referral link.",
  },
  {
    id: "advocate_reward_paid",
    title: "Advocate reward paid",
    description:
      "Notifies advocates when they earn a reward for driving a successful referral.",
  },
];

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function normalizeEmailTemplate(
  input: unknown,
  fallback: ReferralEmailTemplate,
): ReferralEmailTemplate {
  const row = asObject(input);
  return {
    subject: asString(row.subject, fallback.subject),
    headline: asString(row.headline, fallback.headline),
    body: asString(row.body, fallback.body),
    ctaLabel: asString(row.ctaLabel, fallback.ctaLabel),
  };
}

export function normalizeReferralSettings(
  input: unknown,
): ReferralSettings {
  const raw = asObject(input);
  const offer = asObject(raw.offer);
  const widgets = asObject(raw.widgets);
  const emails = asObject(raw.emails);
  const preferences = asObject(raw.preferences);
  const defaults = DEFAULT_REFERRAL_SETTINGS;

  const friendDiscountType =
    offer.friendDiscountType === "fixed" ? "fixed" : "percent";

  const marketingConsentType =
    preferences.marketingConsentType === "opt_in" ||
    preferences.marketingConsentType === "opt_out"
      ? preferences.marketingConsentType
      : "no_consent";

  return {
    offer: {
      friendDiscountType,
      friendDiscountValue: Math.max(
        0,
        asNumber(offer.friendDiscountValue, defaults.offer.friendDiscountValue),
      ),
      rewardAdvocates: asBool(
        offer.rewardAdvocates,
        defaults.offer.rewardAdvocates,
      ),
      advocateRewardValue: Math.max(
        0,
        asNumber(
          offer.advocateRewardValue,
          defaults.offer.advocateRewardValue,
        ),
      ),
      limitRewardedOrders: asBool(
        offer.limitRewardedOrders,
        defaults.offer.limitRewardedOrders,
      ),
      limitRewardedOrdersCount: Math.max(
        1,
        Math.floor(
          asNumber(
            offer.limitRewardedOrdersCount,
            defaults.offer.limitRewardedOrdersCount,
          ),
        ),
      ),
      minimumPurchaseAmount: Math.max(
        0,
        asNumber(
          offer.minimumPurchaseAmount,
          defaults.offer.minimumPurchaseAmount,
        ),
      ),
      combineProductDiscounts: asBool(
        offer.combineProductDiscounts,
        defaults.offer.combineProductDiscounts,
      ),
      combineOrderDiscounts: asBool(
        offer.combineOrderDiscounts,
        defaults.offer.combineOrderDiscounts,
      ),
      combineShippingDiscounts: asBool(
        offer.combineShippingDiscounts,
        defaults.offer.combineShippingDiscounts,
      ),
    },
    widgets: {
      onsite_popup: {
        active: asBool(
          asObject(widgets.onsite_popup).active,
          defaults.widgets.onsite_popup.active,
        ),
      },
      onsite_sidebar: {
        active: asBool(
          asObject(widgets.onsite_sidebar).active,
          defaults.widgets.onsite_sidebar.active,
        ),
      },
      post_purchase: {
        active: asBool(
          asObject(widgets.post_purchase).active,
          defaults.widgets.post_purchase.active,
        ),
      },
      post_purchase_legacy: {
        active: asBool(
          asObject(widgets.post_purchase_legacy).active,
          defaults.widgets.post_purchase_legacy.active,
        ),
      },
      post_review: {
        active: asBool(
          asObject(widgets.post_review).active,
          defaults.widgets.post_review.active,
        ),
      },
    },
    emails: {
      onsite: normalizeEmailTemplate(emails.onsite, defaults.emails.onsite),
      post_review: normalizeEmailTemplate(
        emails.post_review,
        defaults.emails.post_review,
      ),
      post_purchase: normalizeEmailTemplate(
        emails.post_purchase,
        defaults.emails.post_purchase,
      ),
      advocate_reward_paid: normalizeEmailTemplate(
        emails.advocate_reward_paid,
        defaults.emails.advocate_reward_paid,
      ),
    },
    preferences: {
      preventAdvocateSelfRewards: asBool(
        preferences.preventAdvocateSelfRewards,
        defaults.preferences.preventAdvocateSelfRewards,
      ),
      redeemDelayEnabled: asBool(
        preferences.redeemDelayEnabled,
        defaults.preferences.redeemDelayEnabled,
      ),
      limitDiscountsToNewCustomers: asBool(
        preferences.limitDiscountsToNewCustomers,
        defaults.preferences.limitDiscountsToNewCustomers,
      ),
      preventSelfReferrals: asBool(
        preferences.preventSelfReferrals,
        defaults.preferences.preventSelfReferrals,
      ),
      socialMediaImageUrl:
        typeof preferences.socialMediaImageUrl === "string"
          ? preferences.socialMediaImageUrl
          : null,
      socialMediaShareText: asString(
        preferences.socialMediaShareText,
        defaults.preferences.socialMediaShareText,
      ),
      syncAdvocatesToShopify: asBool(
        preferences.syncAdvocatesToShopify,
        defaults.preferences.syncAdvocatesToShopify,
      ),
      marketingConsentType,
      marketingConsentText: asString(
        preferences.marketingConsentText,
        defaults.preferences.marketingConsentText,
      ),
    },
  };
}

export function formatFriendOffer(
  settings: ReferralSettings,
  currencySymbol = "£",
) {
  const value = settings.offer.friendDiscountValue;
  return settings.offer.friendDiscountType === "percent"
    ? `${value}%`
    : `${currencySymbol}${value}`;
}

export function formatAdvocateOffer(
  settings: ReferralSettings,
  currencySymbol = "£",
) {
  if (!settings.offer.rewardAdvocates) return "a reward";
  return `${currencySymbol}${settings.offer.advocateRewardValue}`;
}

export function offerHeadline(
  settings: ReferralSettings,
  currencySymbol = "£",
) {
  return `Your offer: Friends get ${formatFriendOffer(settings, currencySymbol)}`;
}

type BrandingWithReferrals = ShopBranding & {
  referrals?: unknown;
  referralAdvocates?: ReferralAdvocate[];
};

export async function getReferralSettings(shopId: string) {
  const settings = await getShopSettings(shopId);
  const branding = (settings.branding ?? {}) as BrandingWithReferrals;
  return normalizeReferralSettings(branding.referrals);
}

export async function saveReferralSettings(
  shopId: string,
  next: ReferralSettings,
) {
  const settings = await getShopSettings(shopId);
  const branding = {
    ...((settings.branding ?? {}) as BrandingWithReferrals),
  };
  branding.referrals = normalizeReferralSettings(next);
  await updateShopSettingsBranding(shopId, branding);
  return normalizeReferralSettings(branding.referrals);
}

export async function listReferralAdvocates(
  shopId: string,
): Promise<ReferralAdvocate[]> {
  const settings = await getShopSettings(shopId);
  const branding = (settings.branding ?? {}) as BrandingWithReferrals;
  const list = Array.isArray(branding.referralAdvocates)
    ? branding.referralAdvocates
    : [];
  return list
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Partial<ReferralAdvocate>;
      if (!item.id || !item.email || !item.code) return null;
      return {
        id: String(item.id),
        email: String(item.email),
        name: item.name ? String(item.name) : null,
        code: String(item.code),
        source:
          item.source === "post_review" || item.source === "post_purchase"
            ? item.source
            : "onsite",
        rewardCount: Math.max(0, Number(item.rewardCount ?? 0)),
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        marketingConsent: Boolean(item.marketingConsent),
      } satisfies ReferralAdvocate;
    })
    .filter((row): row is ReferralAdvocate => Boolean(row));
}

export function buildAdvocatesCsv(advocates: ReferralAdvocate[]) {
  const header = [
    "id",
    "email",
    "name",
    "code",
    "source",
    "reward_count",
    "marketing_consent",
    "created_at",
  ];
  const lines = [header.join(",")];
  for (const row of advocates) {
    lines.push(
      [
        row.id,
        row.email,
        row.name ?? "",
        row.code,
        row.source,
        String(row.rewardCount),
        row.marketingConsent ? "TRUE" : "FALSE",
        row.createdAt,
      ]
        .map((value) => {
          const text = String(value);
          return /[",\n\r]/.test(text)
            ? `"${text.replace(/"/g, '""')}"`
            : text;
        })
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
