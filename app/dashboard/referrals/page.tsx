import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { ReferralsWorkspace } from "@/components/dashboard/referrals-workspace";
import { getReferralSettings } from "@/services/referrals/settings";

type ReferralsPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function ReferralsPage({
  searchParams,
}: ReferralsPageProps) {
  const params = await searchParams;
  const { shop, shopDomain, query } = await requireDashboardShop(params);
  const settings = await getReferralSettings(shop.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <ReferralsWorkspace
        shopDomain={shopDomain}
        shopName={shop.name ?? shop.shopifyDomain}
        currency={shop.currency ?? "GBP"}
        initialSettings={settings}
        settingsPath={withShopPath("/dashboard/settings", query)}
      />
    </main>
  );
}
