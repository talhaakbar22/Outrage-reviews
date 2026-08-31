import { env } from "@/lib/env";
import { buildReviewEmail } from "@/services/email/templates";
import type { ReviewEmailPayload } from "@/services/email/types";

export type SendEmailResult = {
  provider: "console" | "resend";
  id: string | null;
};

export async function sendReviewEmail(
  payload: ReviewEmailPayload,
): Promise<SendEmailResult> {
  const content = buildReviewEmail(payload);
  const provider = env.emailProvider();

  if (provider === "console") {
    console.log("[email:console]", {
      kind: payload.kind,
      to: payload.to,
      subject: content.subject,
      reviewUrl: payload.reviewUrl,
    });
    return { provider: "console", id: `console-${Date.now()}` };
  }

  const apiKey = env.resendApiKey();
  const from = env.emailFrom();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: content.subject,
      text: content.text,
      html: content.html,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? data.message ?? `Resend send failed (${response.status})`,
    );
  }

  return { provider: "resend", id: data.id ?? null };
}
