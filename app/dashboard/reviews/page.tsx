import { Suspense } from "react";
import { requireDashboardShop } from "@/lib/dashboard/shop-context";
import { ManageReviewsWorkspace } from "@/components/dashboard/manage-reviews";

type ReviewsPageProps = {
  searchParams: Promise<{
    shop?: string;
    host?: string;
  }>;
};

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const params = await searchParams;
  const { shop } = await requireDashboardShop(params);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading reviews…</p>}>
        <ManageReviewsWorkspace
          shopDomain={shop.shopifyDomain}
          detailBasePath="/dashboard/reviews"
        />
      </Suspense>
    </main>
  );
}
