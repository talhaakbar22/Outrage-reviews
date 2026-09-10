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
  const isPhotoReminder = payload.kind === "photo_reminder";

  const subject = isPhotoReminder
    ? `Add a photo to your ${productTitle} review?`
    : isReminder
      ? `Reminder: how was your ${productTitle}?`
      : `How was your ${productTitle}?`;

  const intro = isPhotoReminder
    ? `Thanks again for reviewing ${productTitle}. Photos and videos make reviews even more helpful — if you have a moment, we’d love to see yours.`
    : isReminder
      ? `Just a quick reminder from ${shopName} — we'd still love your thoughts on ${productTitle}.`
      : `Thanks for shopping with ${shopName}. How was your ${productTitle}?`;

  const ctaLabel = isPhotoReminder ? "Add a photo or video" : "Write a review";
  const ctaUrl = payload.productUrl || payload.reviewUrl;

  const text = [
    greeting,
    "",
    intro,
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    isPhotoReminder
      ? `— ${shopName}`
      : "This link is unique to your purchase and expires after a while.",
    ...(isPhotoReminder ? [] : ["", `— ${shopName}`]),
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

export function buildThankYouEmail(payload: ReviewEmailPayload) {
  const firstName = payload.customerName?.split(/\s+/)[0]?.trim() || null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const shopName = payload.shopName;
  const productTitle = payload.productTitle;
  // Public storefront product URL only (never dashboard/admin).
  const productUrl = payload.productUrl || null;
  const productImageUrl = payload.productImageUrl?.trim() || null;

  const subject = `Thank you for your review of ${productTitle}`;

  const text = [
    greeting,
    "",
    `Thank you for taking the time to review ${productTitle}.`,
    "",
    `Your feedback helps other shoppers and means a lot to everyone at ${shopName}.`,
    "",
    productUrl ? `View the product: ${productUrl}` : "",
    "",
    "We hope to see you again soon.",
    "",
    "Warm regards,",
    `The ${shopName} team`,
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");

  const productImageHtml = productImageUrl
    ? `<img
         src="${escapeHtml(productImageUrl)}"
         alt="${escapeHtml(productTitle)}"
         width="520"
         style="display: block; width: 100%; max-width: 520px; height: auto; border: 0; border-radius: 14px 14px 0 0;"
       />`
    : `<div style="height: 180px; background: linear-gradient(145deg, #f4f4f5 0%, #e4e4e7 100%); border-radius: 14px 14px 0 0;"></div>`;

  const productCardInner = `
    ${productImageHtml}
    <div style="padding: 18px 20px 20px; background: #fafafa; border-radius: 0 0 14px 14px; border-top: 1px solid #e4e4e7;">
      <p style="margin: 0 0 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a;">
        Your review
      </p>
      <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 600; line-height: 1.35; color: #18181b;">
        ${escapeHtml(productTitle)}
      </p>
      ${
        productUrl
          ? `<p style="margin: 12px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; color: #18181b;">
               View product →
             </p>`
          : ""
      }
    </div>`;

  const productCardHtml = productUrl
    ? `<a href="${escapeHtml(productUrl)}" style="display: block; text-decoration: none; color: inherit; border: 1px solid #e4e4e7; border-radius: 14px; overflow: hidden;">
         ${productCardInner}
       </a>`
    : `<div style="border: 1px solid #e4e4e7; border-radius: 14px; overflow: hidden;">
         ${productCardInner}
       </div>`;

  const ctaHtml = productUrl
    ? `<p style="margin: 28px 0 0; text-align: center;">
         <a href="${escapeHtml(productUrl)}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600;">
           View product page
         </a>
       </p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #ececef; font-family: Georgia, 'Times New Roman', serif; color: #18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ececef; padding: 36px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 18px 40px rgba(24, 24, 27, 0.06);">
            <tr>
              <td style="background: #18181b; padding: 30px 32px 28px;">
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #a1a1aa;">
                  ${escapeHtml(shopName)}
                </p>
                <h1 style="margin: 12px 0 0; font-size: 30px; line-height: 1.15; font-weight: 400; color: #ffffff; letter-spacing: -0.03em;">
                  Thank you for your review
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="margin: 0 0 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                  ${escapeHtml(greeting)}
                </p>
                <p style="margin: 0 0 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.7; color: #3f3f46;">
                  Thank you for taking the time to review <strong style="color: #18181b;">${escapeHtml(productTitle)}</strong>. Your feedback helps other shoppers choose with confidence and means a lot to our team.
                </p>
                ${productCardHtml}
                ${ctaHtml}
                <p style="margin: 28px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #52525b;">
                  We hope to see you again soon.
                </p>
                <p style="margin: 22px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #18181b;">
                  Warm regards,<br />
                  <strong>The ${escapeHtml(shopName)} team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 28px;">
                <p style="margin: 0; padding-top: 20px; border-top: 1px solid #e4e4e7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                  You’re receiving this because you left a product review for ${escapeHtml(shopName)}.
                  ${productUrl ? ` Product page: ${escapeHtml(productUrl)}` : ""}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export function buildMerchantReplyEmail(payload: MerchantReplyEmailPayload) {
  const firstName = payload.customerName?.split(" ")[0]?.trim() || null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const shopName = payload.shopName;
  const productTitle = payload.productTitle;
  const productUrl = payload.productUrl;
  const productImageUrl = payload.productImageUrl?.trim() || null;

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

  if (productUrl) {
    textLines.push(`View the product: ${productUrl}`);
    textLines.push("");
  }

  textLines.push(
    "If you have more to share, you can leave another note with the store.",
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
      const bg = isStore ? "#18181b" : "#ffffff";
      const textColor = isStore ? "#fafafa" : "#27272a";
      const mutedColor = isStore ? "#a1a1aa" : "#71717a";
      const border = isStore ? "#18181b" : "#e4e4e7";
      const ratingHtml =
        !isStore && message.rating
          ? `<p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; letter-spacing: 0.04em; color: #18181b;">${formatStars(message.rating)}</p>`
          : "";
      const when = message.sentAt
        ? `<span style="color: ${mutedColor}; font-weight: 400;"> · ${escapeHtml(message.sentAt)}</span>`
        : "";

      return `<div style="margin: 0 0 14px; background: ${bg}; border: 1px solid ${border}; border-radius: 16px; padding: 16px 18px;">
  <p style="margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${mutedColor};">${escapeHtml(badge)}</p>
  <p style="margin: 0 0 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; color: ${isStore ? "#ffffff" : "#18181b"};">${escapeHtml(who)}${when}</p>
  ${ratingHtml}
  <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.65; color: ${textColor}; white-space: pre-wrap;">${nl2br(message.body)}</p>
</div>`;
    })
    .join("");

  const productImageHtml = productImageUrl
    ? `<img
         src="${escapeHtml(productImageUrl)}"
         alt="${escapeHtml(productTitle)}"
         width="88"
         height="88"
         style="display: block; width: 88px; height: 88px; object-fit: cover; border-radius: 12px; border: 0;"
       />`
    : `<div style="width: 88px; height: 88px; border-radius: 12px; background: linear-gradient(145deg, #f4f4f5 0%, #e4e4e7 100%);"></div>`;

  const productRowInner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="88" valign="middle" style="padding-right: 16px;">
          ${productImageHtml}
        </td>
        <td valign="middle">
          <p style="margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a;">
            Product
          </p>
          <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 600; line-height: 1.35; color: #18181b;">
            ${escapeHtml(productTitle)}
          </p>
          ${
            productUrl
              ? `<p style="margin: 8px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; color: #18181b;">
                   View on store →
                 </p>`
              : ""
          }
        </td>
      </tr>
    </table>`;

  const productCardHtml = productUrl
    ? `<a href="${escapeHtml(productUrl)}" style="display: block; text-decoration: none; color: inherit; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 16px; padding: 14px; margin: 0 0 24px;">
         ${productRowInner}
       </a>`
    : `<div style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 16px; padding: 14px; margin: 0 0 24px;">
         ${productRowInner}
       </div>`;

  const ctaHtml = productUrl
    ? `<p style="margin: 8px 0 24px; text-align: center;">
         <a href="${escapeHtml(productUrl)}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600;">
           View product page
         </a>
       </p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #ececef; color: #18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ececef; padding: 36px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e4e4e7; box-shadow: 0 18px 40px rgba(24, 24, 27, 0.06);">
            <tr>
              <td style="background: #18181b; padding: 30px 32px 28px;">
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #a1a1aa;">
                  ${escapeHtml(shopName)}
                </p>
                <h1 style="margin: 12px 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; line-height: 1.2; font-weight: 400; color: #ffffff; letter-spacing: -0.02em;">
                  They replied to your review
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="margin: 0 0 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                  ${escapeHtml(greeting)}
                </p>
                <p style="margin: 0 0 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.7; color: #3f3f46;">
                  ${escapeHtml(shopName)} just responded about <strong style="color: #18181b;">${escapeHtml(productTitle)}</strong>. Here’s the full conversation.
                </p>
                ${productCardHtml}
                ${conversationHtml}
                ${ctaHtml}
                <p style="margin: 8px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.5; color: #71717a;">
                  You’re receiving this because you left a review for ${escapeHtml(shopName)}.
                  ${productUrl ? ` Product page: ${escapeHtml(productUrl)}` : ""}
                </p>
                <p style="margin: 18px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #18181b;">
                  — ${escapeHtml(shopName)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}
