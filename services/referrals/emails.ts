import { getDb, toIsoString } from "@/lib/prisma";
import { deliverEmail } from "@/services/email/send";
import {
  formatAdvocateOffer,
  formatFriendOffer,
  getReferralSettings,
  type ReferralEmailKind,
} from "@/services/referrals/settings";

function currencySymbol(code: string | null | undefined) {
  const c = (code || "GBP").toUpperCase();
  if (c === "GBP") return "£";
  if (c === "EUR") return "€";
  if (c === "USD") return "$";
  return `${c} `;
}

function applyTokens(
  template: string,
  tokens: Record<string, string>,
) {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

function buildHtml(input: {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  return `<!doctype html>
<html><body style="font-family:Georgia,serif;background:#fafafa;padding:24px;color:#18181b;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;padding:32px;">
    <h1 style="font-size:28px;margin:0 0 12px;">${escapeHtml(input.headline)}</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">${escapeHtml(input.body)}</p>
    <p style="margin:0;">
      <a href="${escapeAttr(input.ctaUrl)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;font-size:14px;">
        ${escapeHtml(input.ctaLabel)}
      </a>
    </p>
  </div>
</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

async function sendAdvocateTemplateEmail(input: {
  shopId: string;
  advocateId: string;
  kind: ReferralEmailKind;
  productTitle?: string | null;
  rewardCode?: string | null;
}) {
  const db = getDb();
  const shop = await db.orm.public.Shop.where({ id: input.shopId }).first();
  const advocate = await db.orm.public.ReferralAdvocate.where({
    id: input.advocateId,
  }).first();
  if (!shop || !advocate) return null;

  const settings = await getReferralSettings(input.shopId);
  const template = settings.emails[input.kind];
  const symbol = currencySymbol(shop.currency);
  const friendOffer = formatFriendOffer(settings, symbol);
  const advocateOffer = formatAdvocateOffer(settings, symbol);
  const shopName = shop.name ?? shop.shopifyDomain;
  const shareUrl = `https://${shop.shopifyDomain}/?or_ref=${encodeURIComponent(advocate.code)}`;
  const ctaUrl =
    input.rewardCode
      ? `https://${shop.shopifyDomain}/discount/${encodeURIComponent(input.rewardCode)}`
      : shareUrl;

  const tokens = {
    shopName,
    friendOffer,
    advocateOffer,
    productTitle: input.productTitle ?? "your purchase",
    code: advocate.code,
    rewardCode: input.rewardCode ?? "",
  };

  const subject = applyTokens(template.subject, tokens);
  const headline = applyTokens(template.headline, tokens);
  const body = applyTokens(template.body, tokens);
  const ctaLabel = applyTokens(template.ctaLabel, tokens);

  return deliverEmail({
    to: advocate.email,
    subject,
    text: `${headline}\n\n${body}\n\n${ctaLabel}: ${ctaUrl}`,
    html: buildHtml({ headline, body, ctaLabel, ctaUrl }),
    logKind: `referral_${input.kind}`,
  });
}

export async function sendAdvocateInviteEmail(input: {
  shopId: string;
  advocateId: string;
  kind: Exclude<ReferralEmailKind, "advocate_reward_paid">;
  productTitle?: string | null;
}) {
  return sendAdvocateTemplateEmail(input);
}

export async function sendAdvocateRewardEmail(input: {
  shopId: string;
  advocateId: string;
  rewardCode?: string | null;
}) {
  return sendAdvocateTemplateEmail({
    ...input,
    kind: "advocate_reward_paid",
  });
}

export function advocateCreatedAtIso(value: unknown) {
  return toIsoString(value as never) ?? new Date().toISOString();
}
