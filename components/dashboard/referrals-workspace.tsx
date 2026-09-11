"use client";

import { useMemo, useState, useTransition } from "react";
import {
  REFERRAL_EMAIL_CATALOG,
  REFERRAL_WIDGET_CATALOG,
  formatAdvocateOffer,
  formatFriendOffer,
  offerHeadline,
  type ReferralEmailKind,
  type ReferralSettings,
  type ReferralWidgetId,
} from "@/services/referrals/settings";

type TabId = "offer" | "widgets" | "emails" | "general";

function currencySymbol(currency: string) {
  if (currency.toUpperCase() === "GBP") return "£";
  if (currency.toUpperCase() === "EUR") return "€";
  if (currency.toUpperCase() === "USD") return "$";
  return currency.toUpperCase() + " ";
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-800 dark:text-zinc-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-zinc-950 dark:bg-zinc-50" : "bg-zinc-300 dark:bg-zinc-700"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition dark:bg-zinc-900 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <div className="rounded-[1.35rem] border border-zinc-200/90 bg-white/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_40px_-30px_rgba(24,24,27,0.3)] dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-none">
        {children}
      </div>
    </section>
  );
}

export function ReferralsWorkspace({
  shopDomain,
  shopName,
  currency,
  initialSettings,
}: {
  shopDomain: string;
  shopName: string;
  currency: string;
  initialSettings: ReferralSettings;
  settingsPath?: string;
}) {
  const [tab, setTab] = useState<TabId>("offer");
  const [settings, setSettings] = useState(initialSettings);
  const [editingEmail, setEditingEmail] = useState<ReferralEmailKind | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const symbol = currencySymbol(currency);

  const headline = useMemo(
    () => offerHeadline(settings, symbol),
    [settings, symbol],
  );

  function patchOffer(partial: Partial<ReferralSettings["offer"]>) {
    setSettings((current) => ({
      ...current,
      offer: { ...current.offer, ...partial },
    }));
  }

  function patchPreferences(
    partial: Partial<ReferralSettings["preferences"]>,
  ) {
    setSettings((current) => ({
      ...current,
      preferences: { ...current.preferences, ...partial },
    }));
  }

  function setWidgetActive(id: ReferralWidgetId, active: boolean) {
    setSettings((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        [id]: { ...current.widgets[id], active },
      },
    }));
  }

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/referrals?shop=${encodeURIComponent(shopDomain)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings }),
          },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to save");
        }
        setSettings(data.settings);
        setMessage("Referral settings saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  async function downloadAdvocates() {
    setError(null);
    try {
      const response = await fetch(
        `/api/referrals/advocates/export?shop=${encodeURIComponent(shopDomain)}`,
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${shopDomain.replace(/\.myshopify\.com$/i, "")}-advocates.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "offer", label: "Offer" },
    { id: "widgets", label: "Referral Widgets" },
    { id: "emails", label: "Emails" },
    { id: "general", label: "General" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="lux-eyebrow">Growth</p>
          <h1 className="lux-page-title mt-2">Referrals</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Build a luxury referral program — friend discounts, advocate rewards,
            widgets, emails, and fraud protections — matching every Loox referral
            case.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200/80 bg-zinc-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/80">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                active
                  ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                  : "text-zinc-600 hover:bg-white/80 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "offer" ? (
        <div className="space-y-8">
          <SettingCard
            title="Referral offer"
            description="Define the discount advocates give to their friends and the reward they get for successful referrals."
          >
            <div className="space-y-6">
              <div>
                <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                  {headline}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Friends get {formatFriendOffer(settings, symbol)}
                  {settings.offer.rewardAdvocates
                    ? ` · Advocates earn ${formatAdvocateOffer(settings, symbol)}`
                    : ""}
                </p>
              </div>

              <div className="space-y-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Friend discount
                </p>
                <p className="text-sm text-zinc-500">
                  Set the discount friends receive when they use the referral link.
                </p>
                <div className="mt-3 flex max-w-xs overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700">
                  <select
                    value={settings.offer.friendDiscountType}
                    onChange={(event) =>
                      patchOffer({
                        friendDiscountType: event.target.value as
                          | "percent"
                          | "fixed",
                      })
                    }
                    className="border-r border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">{symbol.trim() || currency}</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={settings.offer.friendDiscountValue}
                    onChange={(event) =>
                      patchOffer({
                        friendDiscountValue: Number(event.target.value || 0),
                      })
                    }
                    className="w-full bg-white px-3 py-2 text-sm outline-none dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Advocate reward
                </p>
                <p className="text-sm text-zinc-500">
                  Set the reward advocates earn for each successful referral.
                  Rewards are earned every time their referral link is used.
                </p>
                <Toggle
                  checked={settings.offer.rewardAdvocates}
                  onChange={(value) => patchOffer({ rewardAdvocates: value })}
                  label="Reward advocates for referrals"
                />
                <div className="flex max-w-xs overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700">
                  <span className="border-r border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    {symbol.trim() || currency}
                  </span>
                  <input
                    type="number"
                    min={0}
                    disabled={!settings.offer.rewardAdvocates}
                    value={settings.offer.advocateRewardValue}
                    onChange={(event) =>
                      patchOffer({
                        advocateRewardValue: Number(event.target.value || 0),
                      })
                    }
                    className="w-full bg-white px-3 py-2 text-sm outline-none disabled:opacity-50 dark:bg-zinc-950"
                  />
                </div>
                <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={settings.offer.limitRewardedOrders}
                    onChange={(event) =>
                      patchOffer({ limitRewardedOrders: event.target.checked })
                    }
                  />
                  <span>
                    Limit rewarded referral orders per advocate
                    <span className="mt-2 flex max-w-[8rem]">
                      <input
                        type="number"
                        min={1}
                        disabled={!settings.offer.limitRewardedOrders}
                        value={settings.offer.limitRewardedOrdersCount}
                        onChange={(event) =>
                          patchOffer({
                            limitRewardedOrdersCount: Number(
                              event.target.value || 1,
                            ),
                          })
                        }
                        className="form-control"
                      />
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Minimum purchase amount
                </p>
                <p className="text-sm text-zinc-500">
                  Set the minimum order value for discounts and rewards to apply.
                </p>
                <div className="flex max-w-xs overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700">
                  <span className="border-r border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    {symbol.trim() || currency}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={settings.offer.minimumPurchaseAmount}
                    onChange={(event) =>
                      patchOffer({
                        minimumPurchaseAmount: Number(event.target.value || 0),
                      })
                    }
                    className="w-full bg-white px-3 py-2 text-sm outline-none dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Discount combinations
                </p>
                <p className="text-sm text-zinc-500">
                  Allow customers to combine multiple discounts at checkout.
                </p>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-medium">Update permissions</p>
                  <p className="mt-1 text-amber-900/90 dark:text-amber-100/80">
                    Outrage Reviews needs write_discounts access to activate
                    combined referral discounts in Shopify.
                  </p>
                </div>
                {(
                  [
                    ["combineProductDiscounts", "Product discounts"],
                    ["combineOrderDiscounts", "Order discounts"],
                    ["combineShippingDiscounts", "Shipping discounts"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <input
                      type="checkbox"
                      checked={settings.offer[key]}
                      onChange={(event) =>
                        patchOffer({ [key]: event.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </SettingCard>
        </div>
      ) : null}

      {tab === "widgets" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {REFERRAL_WIDGET_CATALOG.map((widget) => {
            const active = settings.widgets[widget.id].active;
            return (
              <article
                key={widget.id}
                className="overflow-hidden rounded-[1.35rem] border border-zinc-200/90 bg-white/90 shadow-[0_18px_40px_-30px_rgba(24,24,27,0.3)] dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="relative border-b border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-5 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900">
                  {widget.badge ? (
                    <span className="absolute right-4 top-4 rounded-full bg-zinc-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white dark:bg-zinc-50 dark:text-zinc-950">
                      {widget.badge}
                    </span>
                  ) : null}
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/95 p-4 dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                      Give {formatFriendOffer(settings, symbol)}
                      {settings.offer.rewardAdvocates
                        ? `, Get ${formatAdvocateOffer(settings, symbol)}`
                        : ""}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {widget.previewLabel}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
                      {widget.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {widget.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
                      onClick={() => setTab("offer")}
                    >
                      Customize offer
                    </button>
                    <button
                      type="button"
                      onClick={() => setWidgetActive(widget.id, !active)}
                      className={
                        active
                          ? "rounded-xl bg-emerald-100 px-3.5 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : "btn-primary"
                      }
                    >
                      {active ? "Activated" : "Activate"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "emails" ? (
        <SettingCard
          title="Referral emails"
          description="Customize referral emails sent to your customers across onsite, post-review, post-purchase, and reward-paid cases."
        >
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {REFERRAL_EMAIL_CATALOG.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 max-w-xl">
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {item.description}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setEditingEmail((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                >
                  {editingEmail === item.id ? "Close" : "Edit"}
                </button>
                {editingEmail === item.id ? (
                  <div className="w-full space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    {(
                      [
                        ["subject", "Subject"],
                        ["headline", "Headline"],
                        ["body", "Body"],
                        ["ctaLabel", "CTA label"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="block space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          {label}
                        </span>
                        {key === "body" ? (
                          <textarea
                            rows={4}
                            value={settings.emails[item.id][key]}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                emails: {
                                  ...current.emails,
                                  [item.id]: {
                                    ...current.emails[item.id],
                                    [key]: event.target.value,
                                  },
                                },
                              }))
                            }
                            className="form-control"
                          />
                        ) : (
                          <input
                            value={settings.emails[item.id][key]}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                emails: {
                                  ...current.emails,
                                  [item.id]: {
                                    ...current.emails[item.id],
                                    [key]: event.target.value,
                                  },
                                },
                              }))
                            }
                            className="form-control"
                          />
                        )}
                      </label>
                    ))}
                    <p className="text-xs text-zinc-500">
                      Variables: {"{{shopName}}"}, {"{{productTitle}}"},{" "}
                      {"{{friendOffer}}"}, {"{{advocateOffer}}"}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SettingCard>
      ) : null}

      {tab === "general" ? (
        <div className="space-y-8">
          <SettingCard
            title="Fraud protection"
            description="Protect your referral program from misuse by enabling fraud prevention settings."
          >
            <div className="space-y-4">
              <Toggle
                checked={settings.preferences.preventAdvocateSelfRewards}
                onChange={(value) =>
                  patchPreferences({ preventAdvocateSelfRewards: value })
                }
                label="Prevent advocate self-rewards"
              />
              <Toggle
                checked={settings.preferences.redeemDelayEnabled}
                onChange={(value) =>
                  patchPreferences({ redeemDelayEnabled: value })
                }
                label="30-second redeem delay"
              />
              <Toggle
                checked={settings.preferences.limitDiscountsToNewCustomers}
                onChange={(value) =>
                  patchPreferences({ limitDiscountsToNewCustomers: value })
                }
                label="Limit discounts to new customers only"
              />
              <Toggle
                checked={settings.preferences.preventSelfReferrals}
                onChange={(value) =>
                  patchPreferences({ preventSelfReferrals: value })
                }
                label="Prevent self-referrals"
              />
            </div>
          </SettingCard>

          <SettingCard
            title="Social media image"
            description="Select the image displayed with referral links shared on social media."
          >
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 text-zinc-50 dark:border-zinc-700">
                <div className="flex aspect-[1.9/1] items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(250,250,250,0.18),transparent_45%),linear-gradient(145deg,#18181b,#09090b)] p-6 text-center">
                  {settings.preferences.socialMediaImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={settings.preferences.socialMediaImageUrl}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <p className="font-display text-3xl font-semibold tracking-[-0.02em]">
                      Give {formatFriendOffer(settings, symbol)}
                    </p>
                  )}
                </div>
                <div className="border-t border-zinc-800 px-4 py-3 text-sm text-zinc-300">
                  {settings.preferences.socialMediaShareText
                    .replaceAll("{{friendOffer}}", formatFriendOffer(settings, symbol))
                    .replaceAll("{{shopName}}", shopName)}
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Image URL
                </span>
                <input
                  value={settings.preferences.socialMediaImageUrl ?? ""}
                  onChange={(event) =>
                    patchPreferences({
                      socialMediaImageUrl: event.target.value.trim() || null,
                    })
                  }
                  placeholder="https://cdn.shopify.com/…/referral-share.jpg"
                  className="form-control"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Share text
                </span>
                <textarea
                  rows={3}
                  value={settings.preferences.socialMediaShareText}
                  onChange={(event) =>
                    patchPreferences({
                      socialMediaShareText: event.target.value,
                    })
                  }
                  className="form-control"
                />
              </label>
              <p className="text-xs text-zinc-500">
                Upload an image (JPEG, PNG, JPG, or WEBP) up to 15 MB to your CDN,
                then paste the URL here.
              </p>
            </div>
          </SettingCard>

          <SettingCard
            title="Sync advocates to Shopify"
            description="Add Onsite advocates to your Shopify Customers list and collect marketing consent."
          >
            <div className="space-y-4">
              <Toggle
                checked={settings.preferences.syncAdvocatesToShopify}
                onChange={(value) =>
                  patchPreferences({ syncAdvocatesToShopify: value })
                }
                label="Add Onsite advocates to Shopify Customers list"
              />
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Marketing consent request type
                </span>
                <select
                  value={settings.preferences.marketingConsentType}
                  onChange={(event) =>
                    patchPreferences({
                      marketingConsentType: event.target.value as
                        | "no_consent"
                        | "opt_in"
                        | "opt_out",
                    })
                  }
                  className="form-control"
                >
                  <option value="no_consent">No consent</option>
                  <option value="opt_in">Opt in</option>
                  <option value="opt_out">Opt out</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Marketing consent text
                </span>
                <input
                  value={settings.preferences.marketingConsentText}
                  onChange={(event) =>
                    patchPreferences({
                      marketingConsentText: event.target.value,
                    })
                  }
                  className="form-control"
                />
              </label>
            </div>
          </SettingCard>

          <SettingCard
            title="Referral advocates"
            description="Export advocate information to a CSV file."
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  Download advocate CSV
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Includes email, referral code, source, rewards, and consent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void downloadAdvocates()}
                className="btn-secondary"
              >
                Download CSV
              </button>
            </div>
          </SettingCard>
        </div>
      ) : null}
    </div>
  );
}
