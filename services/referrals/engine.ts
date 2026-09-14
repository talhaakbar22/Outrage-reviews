import { createHash, randomBytes } from "node:crypto";
import type { Session } from "@shopify/shopify-api";
import { getDb, nowInstant, toIsoString } from "@/lib/prisma";
import { createGraphqlClient } from "@/lib/shopify/client";
import { loadOfflineSessionByShopId } from "@/services/shop/service";
import {
  formatAdvocateOffer,
  formatFriendOffer,
  getReferralSettings,
  type ReferralAdvocate,
  type ReferralSettings,
} from "@/services/referrals/settings";

export type AdvocateSource = "onsite" | "post_review" | "post_purchase";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateCode(seed: string) {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return `OR${hash}`.toUpperCase();
}

function generateDiscountCode(prefix: string) {
  return `${prefix}-${randomBytes(3).toString("hex")}`.toUpperCase();
}

function currencyCode(shopCurrency: string | null | undefined) {
  return (shopCurrency || "GBP").toUpperCase();
}

function currencySymbol(code: string) {
  if (code === "GBP") return "£";
  if (code === "EUR") return "€";
  if (code === "USD") return "$";
  return `${code} `;
}

async function createShopifyDiscountCode(input: {
  session: Session;
  title: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  currency: string;
  minimumPurchase: number;
  combinesWith: {
    productDiscounts: boolean;
    orderDiscounts: boolean;
    shippingDiscounts: boolean;
  };
  startsAt: string;
}) {
  const client = createGraphqlClient(input.session);
  const customerGetsValue =
    input.type === "percent"
      ? {
          percentage: Math.min(100, Math.max(0, input.value)) / 100,
        }
      : {
          discountAmount: {
            amount: String(input.value),
            appliesOnEachItem: false,
          },
        };

  const mutation = `#graphql
    mutation referralDiscountCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              codes(first: 1) {
                nodes { code }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    basicCodeDiscount: {
      title: input.title,
      code: input.code,
      startsAt: input.startsAt,
      customerSelection: { all: true },
      customerGets: {
        value: customerGetsValue,
        items: { all: true },
      },
      minimumRequirement:
        input.minimumPurchase > 0
          ? {
              subtotal: {
                greaterThanOrEqualToSubtotal: String(input.minimumPurchase),
              },
            }
          : undefined,
      combinesWith: {
        productDiscounts: input.combinesWith.productDiscounts,
        orderDiscounts: input.combinesWith.orderDiscounts,
        shippingDiscounts: input.combinesWith.shippingDiscounts,
      },
      usageLimit: 1,
      appliesOncePerCustomer: true,
    },
  };

  const response = await client.request(mutation, { variables });
  const payload = response.data?.discountCodeBasicCreate as
    | {
        codeDiscountNode?: { id?: string } | null;
        userErrors?: Array<{ message?: string }>;
      }
    | undefined;

  const errors = payload?.userErrors?.filter((row) => row.message) ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((row) => row.message).join("; "));
  }

  return {
    shopifyDiscountId: payload?.codeDiscountNode?.id ?? null,
    code: input.code,
  };
}

async function maybeSyncAdvocateToShopify(input: {
  session: Session | null;
  settings: ReferralSettings;
  email: string;
  name: string | null;
  marketingConsent: boolean;
}) {
  if (!input.session || !input.settings.preferences.syncAdvocatesToShopify) {
    return null as string | null;
  }

  const client = createGraphqlClient(input.session);
  const mutation = `#graphql
    mutation referralCustomerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { id }
        userErrors { message }
      }
    }
  `;

  const [firstName, ...rest] = (input.name || "").trim().split(/\s+/);
  const response = await client.request(mutation, {
    variables: {
      input: {
        email: input.email,
        firstName: firstName || undefined,
        lastName: rest.join(" ") || undefined,
        emailMarketingConsent:
          input.settings.preferences.marketingConsentType === "no_consent"
            ? undefined
            : {
                marketingState: input.marketingConsent
                  ? "SUBSCRIBED"
                  : "NOT_SUBSCRIBED",
                marketingOptInLevel: "SINGLE_OPT_IN",
              },
        tags: ["outrage-referral-advocate"],
      },
    },
  });

  const payload = response.data?.customerCreate as
    | {
        customer?: { id?: string } | null;
        userErrors?: Array<{ message?: string }>;
      }
    | undefined;

  // Duplicate email is fine — treat as soft success.
  return payload?.customer?.id ?? null;
}

export async function upsertReferralAdvocate(input: {
  shopId: string;
  email: string;
  name?: string | null;
  source: AdvocateSource;
  marketingConsent?: boolean;
  productTitle?: string | null;
}) {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }

  const db = getDb();
  const settings = await getReferralSettings(input.shopId);
  const session = await loadOfflineSessionByShopId(input.shopId);
  const existing = await db.orm.public.ReferralAdvocate.where({
    shopId: input.shopId,
    email,
  }).first();

  if (existing) {
    return existing;
  }

  const code = generateCode(`${input.shopId}:${email}:${Date.now()}`);
  const shopifyCustomerId = await maybeSyncAdvocateToShopify({
    session,
    settings,
    email,
    name: input.name ?? null,
    marketingConsent: Boolean(input.marketingConsent),
  }).catch(() => null);

  const created = await db.orm.public.ReferralAdvocate.create({
    shopId: input.shopId,
    email,
    name: input.name?.trim() || null,
    code,
    source: input.source,
    marketingConsent: Boolean(input.marketingConsent),
    shopifyCustomerId,
    rewardCount: 0,
  });

  if (!created) {
    throw new Error("Failed to create advocate");
  }

  void import("@/services/referrals/emails").then(({ sendAdvocateInviteEmail }) =>
    sendAdvocateInviteEmail({
      shopId: input.shopId,
      advocateId: created.id,
      kind:
        input.source === "post_review"
          ? "post_review"
          : input.source === "post_purchase"
            ? "post_purchase"
            : "onsite",
      productTitle: input.productTitle ?? null,
    }),
  );

  return created;
}

export async function getAdvocateByCode(shopId: string, code: string) {
  const db = getDb();
  return db.orm.public.ReferralAdvocate.where({
    shopId,
    code: code.trim().toUpperCase(),
  }).first();
}

export async function issueFriendDiscount(input: {
  shopId: string;
  advocateCode: string;
  friendEmail?: string | null;
}) {
  const db = getDb();
  const settings = await getReferralSettings(input.shopId);
  const shop = await db.orm.public.Shop.where({ id: input.shopId }).first();
  if (!shop) throw new Error("Shop not found");

  const advocate = await getAdvocateByCode(input.shopId, input.advocateCode);
  if (!advocate) throw new Error("Invalid referral code");

  const friendEmail = input.friendEmail
    ? normalizeEmail(input.friendEmail)
    : null;

  if (
    settings.preferences.preventSelfReferrals &&
    friendEmail &&
    friendEmail === advocate.email
  ) {
    throw new Error("Self-referrals are not allowed");
  }

  if (
    settings.preferences.preventAdvocateSelfRewards &&
    friendEmail &&
    friendEmail === advocate.email
  ) {
    throw new Error("Advocates cannot reward themselves");
  }

  const discountCode = generateDiscountCode(advocate.code.slice(0, 6));
  const session = await loadOfflineSessionByShopId(input.shopId);
  let shopifyDiscountId: string | null = null;

  if (session) {
    try {
      const created = await createShopifyDiscountCode({
        session,
        title: `Referral ${advocate.code}`,
        code: discountCode,
        type: settings.offer.friendDiscountType,
        value: settings.offer.friendDiscountValue,
        currency: currencyCode(shop.currency),
        minimumPurchase: settings.offer.minimumPurchaseAmount,
        combinesWith: {
          productDiscounts: settings.offer.combineProductDiscounts,
          orderDiscounts: settings.offer.combineOrderDiscounts,
          shippingDiscounts: settings.offer.combineShippingDiscounts,
        },
        startsAt: new Date().toISOString(),
      });
      shopifyDiscountId = created.shopifyDiscountId;
    } catch (error) {
      console.error("[referrals] discount create failed:", error);
      // Keep issuing a local code so the flow still works while scopes catch up.
    }
  }

  const redemption = await db.orm.public.ReferralRedemption.create({
    shopId: input.shopId,
    advocateId: advocate.id,
    friendEmail,
    discountCode,
    shopifyDiscountId,
    status: "issued",
    friendDiscountType: settings.offer.friendDiscountType,
    friendDiscountValue: settings.offer.friendDiscountValue,
    minimumPurchase: settings.offer.minimumPurchaseAmount,
  });

  if (!redemption) {
    throw new Error("Failed to issue discount");
  }

  const symbol = currencySymbol(currencyCode(shop.currency));
  return {
    redemption,
    advocate,
    settings,
    discountCode,
    discountUrl: `https://${shop.shopifyDomain}/discount/${encodeURIComponent(discountCode)}`,
    offerLabel: `Give ${formatFriendOffer(settings, symbol)}${
      settings.offer.rewardAdvocates
        ? `, Get ${formatAdvocateOffer(settings, symbol)}`
        : ""
    }`,
    shareText: settings.preferences.socialMediaShareText
      .replaceAll("{{friendOffer}}", formatFriendOffer(settings, symbol))
      .replaceAll("{{advocateOffer}}", formatAdvocateOffer(settings, symbol))
      .replaceAll("{{shopName}}", shop.name ?? shop.shopifyDomain),
    redeemDelayMs: settings.preferences.redeemDelayEnabled ? 30_000 : 0,
  };
}

export async function listAdvocatesForShop(shopId: string) {
  const db = getDb();
  return db.orm.public.ReferralAdvocate.where({ shopId })
    .orderBy((row) => row.createdAt.desc())
    .all();
}

export async function attributeReferralOrder(input: {
  shopId: string;
  shopifyOrderId: string;
  orderId: string;
  email: string | null;
  shopifyCustomerId: string | null;
  discountCodes: string[];
  isNewCustomer: boolean;
  subtotal: number | null;
}) {
  if (input.discountCodes.length === 0) return null;

  const db = getDb();
  const settings = await getReferralSettings(input.shopId);
  const codes = input.discountCodes.map((code) => code.trim().toUpperCase());

  const redemption = await db.orm.public.ReferralRedemption.where({
    shopId: input.shopId,
  })
    .where((row) => row.discountCode.in(codes))
    .where((row) => row.status.in(["issued", "used"]))
    .first();

  if (!redemption) return null;

  if (
    settings.preferences.limitDiscountsToNewCustomers &&
    !input.isNewCustomer
  ) {
    await db.orm.public.ReferralRedemption.where({ id: redemption.id }).update({
      status: "blocked",
      blockedReason: "existing_customer",
    });
    return null;
  }

  if (
    redemption.minimumPurchase > 0 &&
    input.subtotal != null &&
    input.subtotal < redemption.minimumPurchase
  ) {
    await db.orm.public.ReferralRedemption.where({ id: redemption.id }).update({
      status: "blocked",
      blockedReason: "below_minimum_purchase",
    });
    return null;
  }

  const advocate = await db.orm.public.ReferralAdvocate.where({
    id: redemption.advocateId,
  }).first();
  if (!advocate) return null;

  if (
    settings.preferences.preventSelfReferrals &&
    input.email &&
    normalizeEmail(input.email) === advocate.email
  ) {
    await db.orm.public.ReferralRedemption.where({ id: redemption.id }).update({
      status: "blocked",
      blockedReason: "self_referral",
    });
    return null;
  }

  const now = nowInstant();
  await db.orm.public.ReferralRedemption.where({ id: redemption.id }).update({
    status: settings.offer.rewardAdvocates ? "rewarded" : "used",
    orderId: input.orderId,
    shopifyOrderId: input.shopifyOrderId,
    friendEmail: input.email,
    friendCustomerId: input.shopifyCustomerId,
    usedAt: now,
    rewardedAt: settings.offer.rewardAdvocates ? now : null,
  });

  if (settings.offer.rewardAdvocates) {
    if (
      settings.offer.limitRewardedOrders &&
      advocate.rewardCount >= settings.offer.limitRewardedOrdersCount
    ) {
      return { redemptionId: redemption.id, rewarded: false, limited: true };
    }

    const session = await loadOfflineSessionByShopId(input.shopId);
    const rewardCode = generateDiscountCode(`RW${advocate.code.slice(0, 4)}`);
    let shopifyDiscountId: string | null = null;

    if (session) {
      try {
        const shop = await db.orm.public.Shop.where({
          id: input.shopId,
        }).first();
        const created = await createShopifyDiscountCode({
          session,
          title: `Advocate reward ${advocate.code}`,
          code: rewardCode,
          type: "fixed",
          value: settings.offer.advocateRewardValue,
          currency: currencyCode(shop?.currency),
          minimumPurchase: 0,
          combinesWith: {
            productDiscounts: settings.offer.combineProductDiscounts,
            orderDiscounts: settings.offer.combineOrderDiscounts,
            shippingDiscounts: settings.offer.combineShippingDiscounts,
          },
          startsAt: new Date().toISOString(),
        });
        shopifyDiscountId = created.shopifyDiscountId;
      } catch (error) {
        console.error("[referrals] advocate reward discount failed:", error);
      }
    }

    await db.orm.public.ReferralAdvocate.where({ id: advocate.id }).update({
      rewardCount: advocate.rewardCount + 1,
      lastRewardedAt: now,
    });

    void import("@/services/referrals/emails").then(({ sendAdvocateRewardEmail }) =>
      sendAdvocateRewardEmail({
        shopId: input.shopId,
        advocateId: advocate.id,
        rewardCode: shopifyDiscountId ? rewardCode : rewardCode,
      }),
    );

    return {
      redemptionId: redemption.id,
      rewarded: true,
      limited: false,
      rewardCode,
    };
  }

  return { redemptionId: redemption.id, rewarded: false, limited: false };
}

export async function buildReferralPublicPayload(input: {
  shopId: string;
  shopDomain: string;
  widget: keyof ReferralSettings["widgets"];
}) {
  const settings = await getReferralSettings(input.shopId);
  const db = getDb();
  const shop = await db.orm.public.Shop.where({ id: input.shopId }).first();
  const symbol = currencySymbol(currencyCode(shop?.currency));
  const active = settings.widgets[input.widget]?.active ?? false;

  return {
    active,
    shopName: shop?.name ?? input.shopDomain,
    currency: currencyCode(shop?.currency),
    offer: {
      friend: formatFriendOffer(settings, symbol),
      advocate: settings.offer.rewardAdvocates
        ? formatAdvocateOffer(settings, symbol)
        : null,
      headline: `Give ${formatFriendOffer(settings, symbol)}${
        settings.offer.rewardAdvocates
          ? `, Get ${formatAdvocateOffer(settings, symbol)}`
          : ""
      }`,
      minimumPurchase: settings.offer.minimumPurchaseAmount,
    },
    preferences: {
      socialMediaImageUrl: settings.preferences.socialMediaImageUrl,
      socialMediaShareText: settings.preferences.socialMediaShareText,
      marketingConsentType: settings.preferences.marketingConsentType,
      marketingConsentText: settings.preferences.marketingConsentText,
      redeemDelayEnabled: settings.preferences.redeemDelayEnabled,
    },
  };
}

export function toAdvocateCsvRow(row: {
  id: string;
  email: string;
  name: string | null;
  code: string;
  source: string;
  rewardCount: number;
  marketingConsent: boolean;
  createdAt: unknown;
}) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    code: row.code,
    source: row.source as ReferralAdvocate["source"],
    rewardCount: row.rewardCount,
    createdAt: toIsoString(row.createdAt as never) ?? new Date().toISOString(),
    marketingConsent: row.marketingConsent,
  };
}
