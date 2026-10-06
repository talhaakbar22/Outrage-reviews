/**
 * Firestore path helpers for the Phase-2 Outrage Reviews data model.
 * Matches the Postgres → Firestore map under reviewShops/{shopId}/…
 */

export const REVIEW_SHOPS = "reviewShops";

export function shopPath(shopId: string) {
  return `${REVIEW_SHOPS}/${shopId}`;
}

export function shopSettingsPath(shopId: string) {
  return `${shopPath(shopId)}/settings/main`;
}

export function shopSessionsPath(shopId: string) {
  return `${shopPath(shopId)}/sessions`;
}

export function shopSessionPath(shopId: string, sessionId: string) {
  return `${shopSessionsPath(shopId)}/${sessionId}`;
}

export function shopProductsPath(shopId: string) {
  return `${shopPath(shopId)}/products`;
}

export function shopProductPath(shopId: string, productId: string) {
  return `${shopProductsPath(shopId)}/${productId}`;
}

export function shopCustomersPath(shopId: string) {
  return `${shopPath(shopId)}/customers`;
}

export function shopOrdersPath(shopId: string) {
  return `${shopPath(shopId)}/orders`;
}

export function shopOrderPath(shopId: string, orderId: string) {
  return `${shopOrdersPath(shopId)}/${orderId}`;
}

export function shopOrderLineItemsPath(shopId: string, orderId: string) {
  return `${shopOrderPath(shopId, orderId)}/lineItems`;
}

export function shopReviewsPath(shopId: string) {
  return `${shopPath(shopId)}/reviews`;
}

export function shopReviewPath(shopId: string, reviewId: string) {
  return `${shopReviewsPath(shopId)}/${reviewId}`;
}

export function shopReviewMediaPath(shopId: string, reviewId: string) {
  return `${shopReviewPath(shopId, reviewId)}/media`;
}

export function shopReviewRepliesPath(shopId: string, reviewId: string) {
  return `${shopReviewPath(shopId, reviewId)}/replies`;
}

export function shopReviewRequestsPath(shopId: string) {
  return `${shopPath(shopId)}/reviewRequests`;
}

export function shopWebhookEventsPath(shopId: string) {
  return `${shopPath(shopId)}/webhookEvents`;
}

export function shopSyncJobsPath(shopId: string) {
  return `${shopPath(shopId)}/syncJobs`;
}

export function shopReferralAdvocatesPath(shopId: string) {
  return `${shopPath(shopId)}/referralAdvocates`;
}

export function shopReferralRedemptionsPath(shopId: string) {
  return `${shopPath(shopId)}/referralRedemptions`;
}

/** Firebase Storage object prefix for review media (not S3). */
export function reviewMediaStoragePrefix(shopId: string, reviewId: string) {
  return `review-media/${shopId}/${reviewId}`;
}
