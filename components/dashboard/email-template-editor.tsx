"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  EditableEmailTemplate,
  EmailTemplateKind,
} from "@/services/email/editable-templates";

type VariableMeta = {
  key: string;
  label: string;
  description: string;
};

type TemplatePayload = {
  kind: EmailTemplateKind;
  title: string;
  description: string;
  isCustomized: boolean;
  defaults: EditableEmailTemplate;
  template: EditableEmailTemplate;
  variables: VariableMeta[];
  preview: { subject: string; text: string; html: string };
};

export function EmailTemplateEditor({
  shop,
  kind,
  onClose,
}: {
  shop: string;
  kind: EmailTemplateKind;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Pick<
    TemplatePayload,
    "title" | "description" | "isCustomized" | "defaults" | "variables"
  > | null>(null);
  const [draft, setDraft] = useState<EditableEmailTemplate | null>(null);
  const [preview, setPreview] = useState<{
    subject: string;
    html: string;
  } | null>(null);
  const previewTimer = useMemo(() => ({ id: null as ReturnType<typeof setTimeout> | null }), []);

  const showHeadline = kind === "thank_you" || kind === "merchant_reply";

  const query = useMemo(
    () => `shop=${encodeURIComponent(shop)}&kind=${encodeURIComponent(kind)}`,
    [shop, kind],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/email-templates?${query}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load template");
        }
        const template = data.template as TemplatePayload;
        if (cancelled) return;
        setMeta({
          title: template.title,
          description: template.description,
          isCustomized: template.isCustomized,
          defaults: template.defaults,
          variables: template.variables,
        });
        setDraft(template.template);
        setPreview({
          subject: template.preview.subject,
          html: template.preview.html,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function refreshPreview(next: EditableEmailTemplate) {
    try {
      const response = await fetch(
        `/api/email-templates?shop=${encodeURIComponent(shop)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            template: next,
            previewOnly: true,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Preview failed");
      }
      setPreview({
        subject: data.preview.subject,
        html: data.preview.html,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  function updateField<K extends keyof EditableEmailTemplate>(
    key: K,
    value: EditableEmailTemplate[K],
  ) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (previewTimer.id) clearTimeout(previewTimer.id);
      previewTimer.id = setTimeout(() => {
        void refreshPreview(next);
      }, 350);
      return next;
    });
  }

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, body: `${current.body}${current.body ? " " : ""}${token}` };
      void refreshPreview(next);
      return next;
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/email-templates?shop=${encodeURIComponent(shop)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, template: draft }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      const saved = data.template as TemplatePayload;
      setDraft(saved.template);
      setMeta((current) =>
        current
          ? {
              ...current,
              isCustomized: saved.isCustomized,
              defaults: saved.defaults,
            }
          : current,
      );
      setPreview({
        subject: saved.preview.subject,
        html: saved.preview.html,
      });
      setMessage("Template saved. Future emails will use this version.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/email-templates?${query}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Reset failed");
      }
      const saved = data.template as TemplatePayload;
      setDraft(saved.template);
      setMeta((current) =>
        current
          ? {
              ...current,
              isCustomized: false,
              defaults: saved.defaults,
            }
          : current,
      );
      setPreview({
        subject: saved.preview.subject,
        html: saved.preview.html,
      });
      setMessage("Reset to the default template.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {meta?.title ?? "Edit email"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              {meta?.description ?? "Preview and edit the customer email."}
              {meta?.isCustomized ? " · Customized" : " · Default template"}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {loading || !draft ? (
          <div className="p-8 text-sm text-zinc-500">Loading template…</div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-2">
            <div className="space-y-4 overflow-y-auto border-b border-zinc-200 p-5 dark:border-zinc-800 lg:border-b-0 lg:border-r">
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                Subject
                <input
                  value={draft.subject}
                  onChange={(event) => updateField("subject", event.target.value)}
                  className="form-control mt-2"
                />
              </label>

              {showHeadline ? (
                <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                  Headline
                  <input
                    value={draft.headline}
                    onChange={(event) =>
                      updateField("headline", event.target.value)
                    }
                    className="form-control mt-2"
                  />
                </label>
              ) : null}

              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                Body
                <textarea
                  value={draft.body}
                  onChange={(event) => updateField("body", event.target.value)}
                  rows={7}
                  className="form-control mt-2 resize-y"
                />
              </label>

              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                Button label
                <input
                  value={draft.ctaLabel}
                  onChange={(event) => updateField("ctaLabel", event.target.value)}
                  className="form-control mt-2"
                />
              </label>

              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Insert variable
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(meta?.variables ?? []).map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      title={variable.description}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      onClick={() => insertVariable(variable.key)}
                    >
                      {`{{${variable.key}}}`}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Variables are replaced with real customer and product details
                  when the email is sent.
                </p>
              </div>

              {kind === "merchant_reply" ? (
                <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  The review conversation thread is always included after your
                  body text and cannot be removed.
                </p>
              ) : null}

              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              ) : null}
              {message ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {message}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" disabled={saving} onClick={() => void save()}>
                  {saving ? "Saving…" : "Save template"}
                </Button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => void resetToDefault()}
                >
                  Reset to default
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900/40">
              <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Customer preview
                </p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {preview?.subject ?? "…"}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                {preview?.html ? (
                  <iframe
                    title="Email preview"
                    className="h-[560px] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-700"
                    srcDoc={preview.html}
                  />
                ) : (
                  <p className="text-sm text-zinc-500">Preview unavailable</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
