import { requireDashboardShop } from "@/lib/dashboard/shop-context";
import { env } from "@/lib/env";
import { WidgetsWorkspace } from "@/components/dashboard/widgets-workspace";

type WidgetsPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function WidgetsPage({ searchParams }: WidgetsPageProps) {
  const params = await searchParams;
  const { shop, query } = await requireDashboardShop(params);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <WidgetsWorkspace
        shopDomain={shop.shopifyDomain}
        shopifyApiKey={env.shopifyApiKey()}
        host={query.host}
      />
    </main>
  );
}
