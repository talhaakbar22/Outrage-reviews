export type ReviewEmailKind = "request" | "reminder";

export type ReviewEmailPayload = {
  to: string;
  shopName: string;
  productTitle: string;
  customerName: string | null;
  reviewUrl: string;
  kind: ReviewEmailKind;
};

export type ReviewRequestJobData = {
  requestId: string;
  rawToken: string;
};

export type ReviewReminderJobData = {
  requestId: string;
  rawToken: string;
};
