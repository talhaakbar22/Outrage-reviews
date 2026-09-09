import { env } from "@/lib/env";
import {
  buildMerchantReplyEmail,
  buildReviewEmail,
} from "@/services/email/templates";
import type {
  MerchantReplyEmailPayload,
  ReviewEmailPayload,
} from "@/services/email/types";

export type SendEmailResult = {
  provider: "console" | "resend";
  id: string | null;
};

async function deliverEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  logKind: string;
}): Promise<SendEmailResult> {
  const provider = env.emailProvider();

  if (provider === "console") {
    console.log("[email:console]", {
      kind: input.logKind,
      to: input.to,
      subject: input.subject,
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
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        data.message ??
        `Resend send failed (${response.status})`,
    );
  }

  return { provider: "resend", id: data.id ?? null };
}

export async function sendReviewEmail(
  payload: ReviewEmailPayload,
): Promise<SendEmailResult> {
  const content = buildReviewEmail(payload);
  return deliverEmail({
    to: payload.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    logKind: payload.kind,
  });
}

export async function sendMerchantReplyEmailMessage(
  payload: MerchantReplyEmailPayload,
): Promise<SendEmailResult> {
  const content = buildMerchantReplyEmail(payload);
  return deliverEmail({
    to: payload.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    logKind: "merchant_reply",
  });
}
