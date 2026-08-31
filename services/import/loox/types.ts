export type LooxCsvRow = {
  externalId: string;
  productHandle: string | null;
  shopifyProductId: string | null;
  rating: number;
  title: string | null;
  body: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  createdAt: Date;
  photoUrls: string[];
  merchantReply: string | null;
  merchantRepliedAt: Date | null;
  isVerifiedPurchase: boolean;
  status: "published" | "pending" | "rejected";
};

export type LooxImportProgress = {
  totalRows: number;
  processedRows: number;
  importedReviews: number;
  skippedReviews: number;
  failedRows: number;
  downloadedImages: number;
  failedImages: number;
  productsUpdated: number;
  errors: string[];
};

export type LooxImportSummary = LooxImportProgress & {
  syncJobId: string;
};
