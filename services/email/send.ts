import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import {
  buildMerchantReplyEmail,
  buildReviewEmail,
  buildThankYouEmail,
} from "@/services/email/templates";
import type {
  MerchantReplyEmailPayload,
  ReviewEmailPayload,
} from "@/services/email/types";

export type SendEmailResult = {
  provider: "console" | "mailtrap" | "resend";
  id: string | null;
};

async function deliverViaMailtrap(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendEmailResult> {
  const transporter = nodemailer.createTransport({
    host: env.mailtrapHost(),
    port: env.mailtrapPort(),
    auth: {
      user: env.mailtrapUser(),
      pass: env.mailtrapPass(),
    },
  });

  const info = await transporter.sendMail({
    from: env.emailFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return {
    provider: "mailtrap",
    id: typeof info.messageId === "string" ? info.messageId : null,
  };
}

async function deliverViaResend(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendEmailResult> {
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

  if (provider === "mailtrap") {
    const result = await deliverViaMailtrap(input);
    console.log("[email:mailtrap]", {
      kind: input.logKind,
      to: input.to,
      subject: input.subject,
      id: result.id,
    });
    return result;
  }

  return deliverViaResend(input);
}

function contentForReviewEmail(payload: ReviewEmailPayload) {
  if (payload.kind === "thank_you") {
    return buildThankYouEmail(payload);
  }
  return buildReviewEmail(payload);
}

export async function sendReviewEmail(
  payload: ReviewEmailPayload,
): Promise<SendEmailResult> {
  const content = contentForReviewEmail(payload);
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
