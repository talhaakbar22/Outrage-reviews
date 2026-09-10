"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SettingsValues = {
  autoPublishReviews: boolean;
  minRatingToPublish: number;
  requestDelayDays: number;
  reminderDelayDays: number;
  emailEnabled: boolean;
  widgetEnabled: boolean;
};

type CollectRequest = {
  id: string;
  email: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  remindedAt: string | null;
  createdAt: string;
  customerName: string | null;
  productTitle: string | null;
  productImageUrl: string | null;
  orderNumber: string | null;
  fulfillmentStatus: string | null;
  deliveredAt: string | null;
};

type CollectTab =
  | "emails"
  | "requests"
  | "discounts"
  | "form"
  | "preferences";

const EMAIL_TYPES = [
  {
    id: "request",
    title: "Review request",
    description:
      "Ask customers to leave a review after their order is delivered.",
    status: "Active",
  },
  {
    id: "reminder",
    title: "Review request reminder",
    description:
      "Follow up with customers who have not submitted a review yet.",
    status: "Active",
  },
  {
    id: "reply",
    title: "Review reply email",
    description:
      "Notify customers when you reply to their review, with the full conversation.",
    status: "Active",
  },
  {
    id: "photo",
    title: "Photo/video reminder",
    description:
      "Encourage customers who left a text review to add a photo or video (3 days later).",
    status: "Active",
  },
  {
    id: "thanks",
    title: "Thank you email",
    description: "Thank customers after they submit a product review.",
    status: "Active",
  },
] as const;

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  const deltaMs = Date.now() - time;
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function fulfillmentLabel(row: CollectRequest) {
  if (row.deliveredAt) return "Delivered";
  const status = (row.fulfillmentStatus || "").toLowerCase();
  if (!status || status === "unfulfilled" || status === "null") {
    return "Awaiting fulfillment";
  }
  return status.replace(/_/g, " ");
}

function statusBadge(status: string) {
  const value = status.toLowerCase();
  if (value === "sent" || value === "opened") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (value === "pending") {
    return "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (value === "cancelled" || value === "expired") {
    return "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300";
  }
  if (value === "completed") {
    return "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200";
  }
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export function CollectReviewsWorkspace({
  shop,
  host,
  initialSettings,
  initialTab = "emails",
}: {
  shop: string;
  host?: string;
  initialSettings: SettingsValues;
  initialTab?: CollectTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<CollectTab>(initialTab);
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const [requests, setRequests] = useState<CollectRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const querySuffix = useMemo(() => {
    const params = new URLSearchParams({ shop });
    if (host) params.set("host", host);
    return params.toString();
  }, [shop, host]);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    setRequestsError(null);
    try {
      const params = new URLSearchParams({ shop });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/collect/requests?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load requests");
      }
      setRequests(payload.requests ?? []);
    } catch (error) {
      setRequestsError(
        error instanceof Error ? error.message : "Failed to load requests",
      );
    } finally {
      setLoadingRequests(false);
    }
  }, [shop, search]);

  useEffect(() => {
    if (tab === "requests") {
      void loadRequests();
    }
  }, [tab, loadRequests]);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSettingsMessage(null);
    try {
      const response = await fetch(`/api/settings?shop=${encodeURIComponent(shop)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setSettingsMessage("Schedule saved.");
      router.refresh();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function patchRequest(id: string, action: "send_now" | "cancel") {
    setBusyId(id);
    setRequestsError(null);
    try {
      const response = await fetch(
        `/api/collect/requests/${id}?shop=${encodeURIComponent(shop)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      await loadRequests();
    } catch (error) {
      setRequestsError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const tabs: Array<{ id: CollectTab; label: string }> = [
    { id: "emails", label: "Emails & Scheduling" },
    { id: "requests", label: "Review requests" },
    { id: "discounts", label: "Discounts" },
    { id: "form", label: "Review form" },
    { id: "preferences", label: "Preferences" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Collect reviews
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Schedule review emails after delivery, manage pending requests, and
          control how customers are asked for feedback.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "emails" ? (
        <div className="space-y-6">
          <form
            onSubmit={saveSettings}
            className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Email schedule
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Review requests are created when an order is marked delivered,
                then sent after your delay. Thank-you emails send right after a
                review; photo/video reminders wait 3 days for text-only reviews.
              </p>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Send review request emails
              </span>
              <input
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    emailEnabled: event.target.checked,
                  }))
                }
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                Send first email
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={settings.requestDelayDays}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        requestDelayDays: Number(event.target.value),
                      }))
                    }
                    className="form-control"
                  />
                  <span className="whitespace-nowrap text-zinc-500">
                    days after delivery
                  </span>
                </div>
              </label>

              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                Send reminder
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={settings.reminderDelayDays}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        reminderDelayDays: Number(event.target.value),
                      }))
                    }
                    className="form-control"
                  />
                  <span className="whitespace-nowrap text-zinc-500">
                    days after first email
                  </span>
                </div>
              </label>
            </div>

            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              Needs Redis + workers: <code>yarn worker:webhooks</code> and{" "}
              <code>yarn worker:email</code>. For caught test emails set{" "}
              <code>EMAIL_PROVIDER=mailtrap</code> with{" "}
              <code>MAILTRAP_USER</code> / <code>MAILTRAP_PASS</code>.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save schedule"}
              </Button>
              {settingsMessage ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {settingsMessage}
                </p>
              ) : null}
            </div>
          </form>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Automated emails
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Templates use your store name and product details. Active emails
                are already wired in the backend.
              </p>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {EMAIL_TYPES.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-950 dark:text-zinc-50">
                        {item.title}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === "Active"
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        item.id === "request" ||
                        item.id === "reminder" ||
                        item.id === "photo" ||
                        item.id === "thanks"
                      ) {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className="btn-secondary"
                    disabled={item.status !== "Active"}
                  >
                    {item.status === "Active" ? "Configure" : "Soon"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Review requests
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Pending and recent review request emails for this shop.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email"
                className="form-control min-w-[220px]"
              />
              <Button type="button" onClick={() => void loadRequests()}>
                Search
              </Button>
            </div>
          </div>

          {requestsError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{requestsError}</p>
          ) : null}

          {loadingRequests ? (
            <p className="text-sm text-zinc-500">Loading requests…</p>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
              No review requests yet. They appear after an order is delivered and
              email collection is enabled.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((row) => {
                const canSend =
                  !row.sentAt &&
                  row.status !== "completed" &&
                  row.status !== "cancelled" &&
                  row.status !== "expired";
                const canCancel =
                  row.status !== "completed" && row.status !== "cancelled";

                return (
                  <article
                    key={row.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 gap-3">
                        {row.productImageUrl ? (
                          <Image
                            src={row.productImageUrl}
                            alt=""
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-lg object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-950 dark:text-zinc-50">
                            {row.customerName || row.email}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {row.email}
                            {row.orderNumber ? ` · Order ${row.orderNumber}` : ""}
                          </p>
                          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                            {row.productTitle || "Product"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span
                              className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${statusBadge(row.status)}`}
                            >
                              {row.status}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                              {fulfillmentLabel(row)}
                            </span>
                            <span className="text-zinc-500">
                              Created {formatRelative(row.createdAt)}
                            </span>
                            {row.scheduledAt && !row.sentAt ? (
                              <span className="text-zinc-500">
                                Scheduled {formatRelative(row.scheduledAt)}
                              </span>
                            ) : null}
                            {row.sentAt ? (
                              <span className="text-zinc-500">
                                Sent {formatRelative(row.sentAt)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canCancel ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busyId === row.id}
                            onClick={() => void patchRequest(row.id, "cancel")}
                          >
                            Cancel
                          </button>
                        ) : null}
                        {canSend ? (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={busyId === row.id}
                            onClick={() => void patchRequest(row.id, "send_now")}
                          >
                            {busyId === row.id ? "Sending…" : "Send now"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "discounts" ? (
        <ComingSoonCard
          title="Discounts for reviews"
          body="Offer percentage or fixed discounts when customers leave a photo or video review. This needs Shopify Admin discount API scopes and a settings model."
        />
      ) : null}

      {tab === "form" ? (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Review form
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Customers already leave ratings, text, and photos through your review
            request link at <code>/review/[token]</code>. Custom questions are
            next.
          </p>
          <Link
            href={`/dashboard/settings?${querySuffix}`}
            className="btn-secondary inline-flex"
          >
            Open general settings
          </Link>
        </div>
      ) : null}

      {tab === "preferences" ? (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Preferences
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Publishing rules and widget toggles live in Settings. QR codes and
            product groups will land here later.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/settings?${querySuffix}`}
              className="btn-secondary"
            >
              Publishing settings
            </Link>
            <Link
              href={`/dashboard/settings/email?${querySuffix}`}
              className="btn-secondary"
            >
              Classic email settings
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComingSoonCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Coming soon
      </p>
    </div>
  );
}
