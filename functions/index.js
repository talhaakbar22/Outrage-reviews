/**
 * Outrage Reviews Cloud Functions (codebase: outrage-reviews).
 *
 * Phase 2 scaffold — privileged / scheduled work that should not live only in
 * the Next.js process (webhooks at scale, nightly sweeps). Day-to-day CRUD still
 * goes through Next.js + Firebase Admin until repositories are ported.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2/options";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 20 });

const db = getFirestore();

/** Health check — confirms the reviews functions codebase is live. */
export const reviewsHealth = onRequest({ cors: true }, async (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "outrage-reviews",
    projectId: process.env.GCLOUD_PROJECT || null,
    backendHint: "Firestore Admin via Cloud Functions",
  });
});

/**
 * Placeholder scheduled sweep. Wire to review-request / reminder jobs after the
 * Postgres → Firestore cutover (replaces BullMQ workers gradually).
 */
export const reviewsScheduledSweep = onSchedule("every 60 minutes", async () => {
  const snap = await db
    .collectionGroup("syncJobs")
    .where("status", "==", "pending")
    .limit(1)
    .get();

  console.log(
    `[reviewsScheduledSweep] pending syncJobs sample size=${snap.size}`,
  );
});
