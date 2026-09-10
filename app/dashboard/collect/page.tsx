import { requireDashboardShop } from "@/lib/dashboard/shop-context";
import { getShopSettings } from "@/services/dashboard/data";
import { CollectReviewsWorkspace } from "@/components/dashboard/collect-reviews-workspace";

type CollectPageProps = {
  searchParams: Promise<{ shop?: string; host?: string; tab?: string }>;
};

export default async function CollectReviewsPage({
  searchParams,
}: CollectPageProps) {
  const params = await searchParams;
  const { shop, query } = await requireDashboardShop(params);
  const settings = await getShopSettings(shop.id);

  const tab =
    params.tab === "requests" ||
    params.tab === "discounts" ||
    params.tab === "form" ||
    params.tab === "preferences" ||
    params.tab === "emails"
      ? params.tab
      : "emails";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <CollectReviewsWorkspace
        shop={shop.shopifyDomain}
        host={query.host}
        initialTab={tab}
        initialSettings={{
          autoPublishReviews: settings.autoPublishReviews,
          minRatingToPublish: settings.minRatingToPublish,
          requestDelayDays: settings.requestDelayDays,
          reminderDelayDays: settings.reminderDelayDays,
          emailEnabled: settings.emailEnabled,
          widgetEnabled: settings.widgetEnabled,
        }}
      />
    </main>
  );
}
