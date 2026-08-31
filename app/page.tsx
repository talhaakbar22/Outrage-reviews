import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeCorner } from "@/components/theme/theme-corner";
import { loadOfflineSession } from "@/services/shop/service";
import { normalizeShopDomain } from "@/lib/shopify/auth";

type HomePageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const shopParam = params.shop;

  if (shopParam) {
    const shop = normalizeShopDomain(shopParam);
    const session = await loadOfflineSession(shop);

    if (session?.accessToken && session.isActive(undefined)) {
      const dashboard = new URL("/dashboard", "http://local");
      dashboard.searchParams.set("shop", shop);
      if (params.host) {
        dashboard.searchParams.set("host", params.host);
      }
      redirect(`${dashboard.pathname}${dashboard.search}`);
    }

    const auth = new URL("/api/auth", "http://local");
    auth.searchParams.set("shop", shop);
    if (params.host) {
      auth.searchParams.set("host", params.host);
    }
    redirect(`${auth.pathname}${auth.search}`);
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ThemeCorner />
      <main className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Outrage Reviews
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Connect your Shopify store
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Install the app to collect product reviews, sync orders, and publish
          rating metafields to your storefront.
        </p>

        <form action="/api/auth" method="get" className="mt-8 space-y-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Store domain
            <input
              name="shop"
              type="text"
              required
              defaultValue="your-store.myshopify.com"
              placeholder="your-store.myshopify.com"
              className="form-control mt-2 px-4 py-3 text-base"
            />
          </label>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Install / Connect Store
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-500">
          Already installed from Shopify admin? Open the app from your store&apos;s
          Apps menu and we&apos;ll pick up your shop automatically.
        </p>

        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
        >
          Go to dashboard
        </Link>
      </main>
    </div>
  );
}
