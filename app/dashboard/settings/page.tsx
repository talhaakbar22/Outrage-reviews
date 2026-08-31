import Link from "next/link";
import { Suspense } from "react";
import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { getShopSettings } from "@/services/dashboard/data";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { AppearanceSettings } from "@/components/theme/appearance-settings";

type SettingsPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const { shop, query } = await requireDashboardShop(params);
  const settings = await getShopSettings(shop.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Settings
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Publishing rules, email timing, and integrations.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          href={withShopPath("/dashboard/settings/email", query)}
          className="rounded-lg bg-white px-3 py-2 text-zinc-900 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-800"
        >
          Email settings
        </Link>
        <Link
          href={withShopPath("/dashboard/settings/integrations", query)}
          className="rounded-lg bg-white px-3 py-2 text-zinc-900 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-800"
        >
          Integrations
        </Link>
      </div>

      <AppearanceSettings />

      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading…</p>}>
        <SettingsForm
          mode="general"
          initial={{
            autoPublishReviews: settings.autoPublishReviews,
            minRatingToPublish: settings.minRatingToPublish,
            requestDelayDays: settings.requestDelayDays,
            reminderDelayDays: settings.reminderDelayDays,
            emailEnabled: settings.emailEnabled,
            widgetEnabled: settings.widgetEnabled,
          }}
        />
      </Suspense>
    </main>
  );
}
