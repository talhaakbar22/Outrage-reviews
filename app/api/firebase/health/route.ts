import { NextResponse } from "next/server";
import { getReviewsDataBackend, isFirestoreEnabled } from "@/lib/firebase/data-backend";

export const runtime = "nodejs";

/**
 * GET /api/firebase/health
 *
 * Phase 2 smoke check — does not require Shopify auth. Verifies env + optional
 * Admin SDK connectivity when REVIEWS_DATA_BACKEND includes firestore.
 */
export async function GET() {
  const backend = getReviewsDataBackend();
  const payload: Record<string, unknown> = {
    ok: true,
    reviewsDataBackend: backend,
    firebaseProjectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "outrageldn-dashboard",
    firestoreEnabled: isFirestoreEnabled(),
    authConfigured: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
        process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ),
    adminCredentialConfigured: Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
    ),
  };

  if (isFirestoreEnabled()) {
    try {
      const { adminDb } = await import("@/lib/firebase/admin");
      // Lightweight connectivity probe — empty collection is fine.
      await adminDb().collection("reviewShops").limit(1).get();
      payload.firestoreReachable = true;
    } catch (error) {
      payload.ok = false;
      payload.firestoreReachable = false;
      payload.firestoreError =
        error instanceof Error ? error.message : String(error);
      return NextResponse.json(payload, { status: 503 });
    }
  }

  return NextResponse.json(payload);
}
