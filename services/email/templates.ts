import type { ReviewEmailPayload } from "@/services/email/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildReviewEmail(payload: ReviewEmailPayload) {
  const greeting = payload.customerName
    ? `Hi ${payload.customerName},`
    : "Hi there,";
  const shopName = payload.shopName;
  const productTitle = payload.productTitle;
  const isReminder = payload.kind === "reminder";

  const subject = isReminder
    ? `Reminder: how was your ${productTitle}?`
    : `How was your ${productTitle}?`;

  const intro = isReminder
    ? `Just a quick reminder from ${shopName} — we'd still love your thoughts on ${productTitle}.`
    : `Thanks for shopping with ${shopName}. How was your ${productTitle}?`;

  const text = [
    greeting,
    "",
    intro,
    "",
    `Leave a review: ${payload.reviewUrl}`,
    "",
    "This link is unique to your purchase and expires after a while.",
    "",
    `— ${shopName}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; line-height: 1.5; color: #18181b; background: #fafafa; padding: 24px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 28px;">
      <p style="margin: 0 0 16px;">${escapeHtml(greeting)}</p>
      <p style="margin: 0 0 24px;">${escapeHtml(intro)}</p>
      <p style="margin: 0 0 28px;">
        <a href="${escapeHtml(payload.reviewUrl)}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          Write a review
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #71717a;">
        Or open this link: ${escapeHtml(payload.reviewUrl)}
      </p>
      <p style="margin: 24px 0 0; font-size: 13px; color: #71717a;">— ${escapeHtml(shopName)}</p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
