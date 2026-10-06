/**
 * Firebase Admin for Outrage Reviews (Next.js server, workers, scripts).
 *
 * Phase 2: sits beside Postgres. Prefer Admin SDK for all privileged reads/writes —
 * Shopify session tokens and review-request token hashes must never be client-readable.
 */

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app: App | undefined;

function projectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "outrageldn-dashboard"
  );
}

function readServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    return cert(JSON.parse(json) as Record<string, unknown>);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    return cert({ projectId: projectId(), clientEmail, privateKey });
  }

  return null;
}

export function getFirebaseAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }

  const usingEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  );

  const credential = readServiceAccount();
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (usingEmulator) {
    // Emulators accept an unauthenticated Admin app bound to the project id.
    app = initializeApp({ projectId: projectId(), storageBucket });
  } else if (credential) {
    app = initializeApp({ credential, projectId: projectId(), storageBucket });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({
      credential: applicationDefault(),
      projectId: projectId(),
      storageBucket,
    });
  } else {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON " +
        "(or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY), or GOOGLE_APPLICATION_CREDENTIALS, " +
        "or run against emulators with FIRESTORE_EMULATOR_HOST.",
    );
  }

  return app;
}

export function adminDb() {
  const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
  return getFirestore(getFirebaseAdminApp(), databaseId);
}

export function adminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function adminStorage() {
  return getStorage(getFirebaseAdminApp());
}

export function adminBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  return bucketName ? adminStorage().bucket(bucketName) : adminStorage().bucket();
}
