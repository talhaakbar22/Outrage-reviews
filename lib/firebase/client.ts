/**
 * Optional Firebase web client for Outrage Reviews.
 *
 * Most dashboard UI stays server-rendered with Shopify session + Admin SDK.
 * Use this only when a browser needs Auth/Storage directly (e.g. staff signed into
 * the main Outrage dashboard opening reviews with the same Firebase user).
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "outrageldn-dashboard",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let clientApp: FirebaseApp | undefined;

export function getFirebaseClientApp(): FirebaseApp {
  if (clientApp) return clientApp;
  if (getApps().length) {
    clientApp = getApps()[0]!;
    return clientApp;
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.appId) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_* config. Copy values from the Firebase web app.",
    );
  }

  clientApp = initializeApp(firebaseConfig);

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
    connectAuthEmulator(getAuth(clientApp), `http://${host}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(clientApp), host, 8080);
    connectStorageEmulator(getStorage(clientApp), host, 9199);
  }

  return clientApp;
}

export function clientAuth() {
  return getAuth(getFirebaseClientApp());
}

export function clientDb() {
  return getFirestore(getFirebaseClientApp());
}

export function clientStorage() {
  return getStorage(getFirebaseClientApp());
}
