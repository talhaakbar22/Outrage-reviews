import Link from "next/link";
import { Suspense } from "react";
import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { LooxImportPanel } from "@/components/import/loox-import-panel";

type IntegrationsPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function IntegrationsPage({
  searchParams,
}: IntegrationsPageProps) {
  const params = await searchParams;
  const { query } = await requireDashboardShop(params);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        href={withShopPath("/dashboard/settings", query)}
        className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        ← Settings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Integrations
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Import historical reviews and connect migration tools.
      </p>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Loox CSV import
        </h2>
        <Suspense fallback={<p className="mt-4 text-sm text-zinc-500">Loading…</p>}>
          <LooxImportPanel />
        </Suspense>
      </div>
    </main>
  );
}
