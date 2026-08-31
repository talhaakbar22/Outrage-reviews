import Link from "next/link";
import { Suspense } from "react";
import {
  requireDashboardShop,
  withShopPath,
} from "@/lib/dashboard/shop-context";
import { getShopSettings } from "@/services/dashboard/data";
import { SettingsForm } from "@/components/dashboard/settings-form";

type EmailSettingsPageProps = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function EmailSettingsPage({
  searchParams,
}: EmailSettingsPageProps) {
  const params = await searchParams;
  const { shop, query } = await requireDashboardShop(params);
  const settings = await getShopSettings(shop.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        href={withShopPath("/dashboard/settings", query)}
        className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        ← Settings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Email settings
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Control when review requests and reminders go out after delivery.
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading…</p>}>
        <SettingsForm
          mode="email"
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
