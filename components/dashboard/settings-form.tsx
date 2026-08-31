"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type SettingsValues = {
  autoPublishReviews: boolean;
  minRatingToPublish: number;
  requestDelayDays: number;
  reminderDelayDays: number;
  emailEnabled: boolean;
  widgetEnabled: boolean;
};

export function SettingsForm({
  initial,
  mode = "all",
}: {
  initial: SettingsValues;
  mode?: "all" | "email" | "general";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!shop) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/settings?shop=${encodeURIComponent(shop)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setMessage("Settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const showGeneral = mode === "all" || mode === "general";
  const showEmail = mode === "all" || mode === "email";

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-6">
      {showGeneral ? (
        <fieldset className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <legend className="px-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Publishing
          </legend>
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={values.autoPublishReviews}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  autoPublishReviews: event.target.checked,
                }))
              }
            />
            Auto-publish reviews that meet the minimum rating
          </label>
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Minimum rating to publish
            <input
              type="number"
              min={1}
              max={5}
              value={values.minRatingToPublish}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  minRatingToPublish: Number(event.target.value),
                }))
              }
              className="form-control mt-2"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={values.widgetEnabled}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  widgetEnabled: event.target.checked,
                }))
              }
            />
            Enable storefront widget
          </label>
        </fieldset>
      ) : null}

      {showEmail ? (
        <fieldset className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <legend className="px-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Review emails
          </legend>
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={values.emailEnabled}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  emailEnabled: event.target.checked,
                }))
              }
            />
            Send review request emails
          </label>
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Days after delivery before first email
            <input
              type="number"
              min={0}
              max={90}
              value={values.requestDelayDays}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  requestDelayDays: Number(event.target.value),
                }))
              }
              className="form-control mt-2"
            />
          </label>
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Days after first email before reminder
            <input
              type="number"
              min={0}
              max={90}
              value={values.reminderDelayDays}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  reminderDelayDays: Number(event.target.value),
                }))
              }
              className="form-control mt-2"
            />
          </label>
        </fieldset>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </Button>
      {message ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p> : null}
    </form>
  );
}
