import {
  getShopSettings,
  updateShopSettingsBranding,
} from "@/services/dashboard/data";
import type { ShopBranding } from "@/services/email/editable-templates";
import {
  buildAdvocatesCsv,
  normalizeReferralSettings,
  type ReferralAdvocate,
  type ReferralSettings,
} from "@/services/referrals/settings-shared";

export * from "@/services/referrals/settings-shared";

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
  const { listAdvocatesForShop, toAdvocateCsvRow } = await import(
    "@/services/referrals/engine"
  );
  const rows = await listAdvocatesForShop(shopId);
  return rows.map((row) => toAdvocateCsvRow(row));
}

export { buildAdvocatesCsv };
