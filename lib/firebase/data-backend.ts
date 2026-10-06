/**
 * Dual-write / cutover switch for Phase 2+.
 *
 * - postgres (default): existing Prisma path
 * - firestore: Admin SDK only (after repositories are ported)
 * - dual: write both while reading from postgres (migration safety)
 */

export type ReviewsDataBackend = "postgres" | "firestore" | "dual";

export function getReviewsDataBackend(): ReviewsDataBackend {
  const value = (process.env.REVIEWS_DATA_BACKEND || "postgres").toLowerCase();
  if (value === "firestore" || value === "dual") return value;
  return "postgres";
}

export function isFirestoreEnabled() {
  const backend = getReviewsDataBackend();
  return backend === "firestore" || backend === "dual";
}

export function isPostgresEnabled() {
  const backend = getReviewsDataBackend();
  return backend === "postgres" || backend === "dual";
}
