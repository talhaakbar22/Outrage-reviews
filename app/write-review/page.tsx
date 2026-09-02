import Link from "next/link";
import { ThemeCorner } from "@/components/theme/theme-corner";
import { getDb } from "@/lib/prisma";

type WriteReviewPageProps = {
  searchParams: Promise<{ shop?: string; product_id?: string }>;
};

function normalizeShopDomain(shop: string) {
  const trimmed = shop.trim().toLowerCase();
  return trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
}

export default async function WriteReviewPage({ searchParams }: WriteReviewPageProps) {
  const params = await searchParams;
  const shopDomain = params.shop ? normalizeShopDomain(params.shop) : null;
  const productId = params.product_id?.replace(/\D/g, "") ?? null;

  let productTitle: string | null = null;

  if (shopDomain && productId) {
    const db = getDb();
    const shop = await db.orm.public.Shop.where({ shopifyDomain: shopDomain }).first();
    if (shop) {
      const product = await db.orm.public.Product.where({
        shopId: shop.id,
        shopifyProductId: productId,
      }).first();
      productTitle = product?.title ?? null;
    }
  }

  return (
    <>
      <ThemeCorner />
      <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-16 text-zinc-950 dark:text-zinc-50">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Write a review
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {productTitle ? `Review ${productTitle}` : "Share your experience"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            Verified reviews are collected after purchase. Check your order confirmation
            or shipping email for a personal review link from this store.
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            If you already received a review request email, open the link in that message
            to submit your rating and feedback.
          </p>
          <Link
            href={shopDomain ? `https://${shopDomain}` : "/"}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Return to store
          </Link>
        </div>
      </main>
    </>
  );
}
