import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * Client-only Firebase setup. Deliberately does NOT import firebase-admin —
 * this project never handles a service account. Authorization is enforced by
 * Firestore Security Rules (see /firestore.rules), not by a trusted server
 * process. Any operation that truly cannot be trusted to the client (e.g.
 * verifying a Paystack transaction) goes through a Next.js Route Handler in
 * app/api/*, which calls Paystack's REST API directly with the secret key —
 * still no Firebase Admin credential involved.
 *
 * IMPORTANT — this exact file is imported from BOTH browser components
 * ("use client") AND server-side Route Handlers (app/api/*, via
 * systemAuth.ts). Firestore's offline persistence (persistentLocalCache)
 * depends on IndexedDB, which does not exist in Vercel's Node.js
 * serverless runtime — enabling it unconditionally would crash or hang
 * every API route the moment it touched Firestore. `typeof window !==
 * "undefined"` is the standard, reliable way to tell the two environments
 * apart; persistence is opt-in only in the real browser.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance() {
  if (typeof window === "undefined") {
    // Server (Route Handlers, SSR): plain Firestore, no browser persistence.
    return getFirestore(firebaseApp);
  }
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // initializeFirestore throws if called twice for the same app (e.g.
    // React Strict Mode double-invoking on the client) — fall back to the
    // already-initialized instance instead of crashing.
    return getFirestore(firebaseApp);
  }
}

export const db = createFirestoreInstance();

export const auth = getAuth(firebaseApp);
