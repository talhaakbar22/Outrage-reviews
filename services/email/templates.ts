import type {
  MerchantReplyEmailPayload,
  ReviewEmailPayload,
} from "@/services/email/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatStars(rating: number | null | undefined) {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function nl2br(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

export function buildReviewEmail(payload: ReviewEmailPayload) {
  const greeting = payload.customerName
    ? `Hi ${payload.customerName},`
    : "Hi there,";
  const shopName = payload.shopName;
  const productTitle = payload.productTitle;
  const isReminder = payload.kind === "reminder";
  const isThankYou = payload.kind === "thank_you";
  const isPhotoReminder = payload.kind === "photo_reminder";

  const subject = isThankYou
    ? `Thanks for reviewing ${productTitle}`
    : isPhotoReminder
      ? `Add a photo to your ${productTitle} review?`
      : isReminder
        ? `Reminder: how was your ${productTitle}?`
        : `How was your ${productTitle}?`;

  const intro = isThankYou
    ? `Thank you for sharing your experience with ${productTitle} from ${shopName}. Your feedback helps other shoppers and means a lot to us.`
    : isPhotoReminder
      ? `Thanks again for reviewing ${productTitle}. Photos and videos make reviews even more helpful — if you have a moment, we’d love to see yours.`
      : isReminder
        ? `Just a quick reminder from ${shopName} — we'd still love your thoughts on ${productTitle}.`
        : `Thanks for shopping with ${shopName}. How was your ${productTitle}?`;

  const ctaLabel = isThankYou
    ? "View product"
    : isPhotoReminder
      ? "Add a photo or video"
      : "Write a review";
  const ctaUrl = payload.productUrl || payload.reviewUrl;

  const text = [
    greeting,
    "",
    intro,
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    isThankYou || isPhotoReminder
      ? `— ${shopName}`
      : "This link is unique to your purchase and expires after a while.",
    ...(isThankYou || isPhotoReminder ? [] : ["", `— ${shopName}`]),
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; line-height: 1.5; color: #18181b; background: #fafafa; padding: 24px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 28px;">
      <p style="margin: 0 0 16px;">${escapeHtml(greeting)}</p>
      <p style="margin: 0 0 24px;">${escapeHtml(intro)}</p>
      <p style="margin: 0 0 28px;">
        <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          ${escapeHtml(ctaLabel)}
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #71717a;">
        Or open this link: ${escapeHtml(ctaUrl)}
      </p>
      <p style="margin: 24px 0 0; font-size: 13px; color: #71717a;">— ${escapeHtml(shopName)}</p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

export function buildMerchantReplyEmail(payload: MerchantReplyEmailPayload) {
  const firstName = payload.customerName?.split(" ")[0]?.trim() || null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const shopName = payload.shopName;
  const productTitle = payload.productTitle;

  const subject = `${shopName} replied to your review of ${productTitle}`;

  const textLines = [
    greeting,
    "",
    `${shopName} just replied to your review of ${productTitle}.`,
    "",
    "Here’s the full conversation:",
    "",
  ];

  for (const message of payload.conversation) {
    const who =
      message.role === "customer"
        ? message.authorName || "You"
        : message.authorName || shopName;
    const when = message.sentAt ? ` · ${message.sentAt}` : "";
    const rating =
      message.role === "customer" && message.rating
        ? ` (${formatStars(message.rating)})`
        : "";
    textLines.push(`${who}${rating}${when}`);
    textLines.push(message.body);
    textLines.push("");
  }

  if (payload.productUrl) {
    textLines.push(`View the product: ${payload.productUrl}`);
    textLines.push("");
  }

  textLines.push(
    "If you have more to share, you can reply to this email or leave another note with the store.",
  );
  textLines.push("");
  textLines.push(`— ${shopName}`);

  const conversationHtml = payload.conversation
    .map((message) => {
      const isStore = message.role === "store";
      const who = isStore
        ? message.authorName || shopName
        : message.authorName || "You";
      const badge = isStore ? "Store reply" : "Your review";
      const bg = isStore ? "#f4f4f5" : "#ffffff";
      const border = isStore ? "#e4e4e7" : "#d4d4d8";
      const ratingHtml =
        !isStore && message.rating
          ? `<p style="margin: 0 0 8px; font-size: 14px; letter-spacing: 0.04em; color: #18181b;">${formatStars(message.rating)}</p>`
          : "";
      const when = message.sentAt
        ? `<span style="color: #71717a; font-weight: 400;"> · ${escapeHtml(message.sentAt)}</span>`
        : "";

      return `<div style="margin: 0 0 14px; background: ${bg}; border: 1px solid ${border}; border-radius: 14px; padding: 16px 18px;">
  <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #71717a;">${escapeHtml(badge)}</p>
  <p style="margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #18181b;">${escapeHtml(who)}${when}</p>
  ${ratingHtml}
  <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #27272a; white-space: pre-wrap;">${nl2br(message.body)}</p>
</div>`;
    })
    .join("");

  const productLinkHtml = payload.productUrl
    ? `<p style="margin: 0 0 24px;">
        <a href="${escapeHtml(payload.productUrl)}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
          View ${escapeHtml(productTitle)}
        </a>
      </p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; line-height: 1.5; color: #18181b; background: #fafafa; padding: 24px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 18px; overflow: hidden;">
      <div style="padding: 28px 28px 8px;">
        <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a;">${escapeHtml(shopName)}</p>
        <h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.25; letter-spacing: -0.02em;">They replied to your review</h1>
        <p style="margin: 0 0 8px; color: #3f3f46;">${escapeHtml(greeting)}</p>
        <p style="margin: 0 0 22px; color: #3f3f46;">
          ${escapeHtml(shopName)} just responded about <strong>${escapeHtml(productTitle)}</strong>. Here’s the full conversation so far.
        </p>
      </div>
      <div style="padding: 0 28px 8px;">
        ${conversationHtml}
      </div>
      <div style="padding: 8px 28px 28px;">
        ${productLinkHtml}
        <p style="margin: 0; font-size: 13px; color: #71717a;">
          You’re receiving this because you left a review for ${escapeHtml(shopName)}.
        </p>
        <p style="margin: 18px 0 0; font-size: 13px; color: #71717a;">— ${escapeHtml(shopName)}</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}
