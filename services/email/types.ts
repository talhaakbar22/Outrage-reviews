export type ReviewEmailKind = "request" | "reminder" | "thank_you" | "photo_reminder";

export type ReviewEmailPayload = {
  to: string;
  shopName: string;
  productTitle: string;
  customerName: string | null;
  reviewUrl: string;
  kind: ReviewEmailKind;
  productUrl?: string | null;
  productImageUrl?: string | null;
};

export type ConversationMessage = {
  role: "customer" | "store";
  authorName: string;
  body: string;
  rating?: number | null;
  sentAt: string | null;
};

export type MerchantReplyEmailPayload = {
  to: string;
  shopName: string;
  shopDomain: string;
  productTitle: string;
  productUrl: string | null;
  customerName: string | null;
  conversation: ConversationMessage[];
};

export type ReviewRequestJobData = {
  requestId: string;
  rawToken: string;
};

export type ReviewReminderJobData = {
  requestId: string;
  rawToken: string;
};

export type PhotoReminderJobData = {
  reviewId: string;
  shopId: string;
};
