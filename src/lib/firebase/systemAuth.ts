import "server-only";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * ARCHITECTURE NOTE — how server routes write trusted data without an
 * Admin SDK / service account:
 *
 * Firestore Security Rules are the only real authorization boundary in this
 * project (see firestore.rules). A Next.js Route Handler (app/api/*) is
 * still just another Firestore CLIENT unless it authenticates as *someone*.
 * Rather than pull in firebase-admin (which needs a service-account JSON —
 * explicitly out of scope per the build brief), this project authenticates
 * server routes as a single dedicated Firebase Auth user whose role is
 * "system" in Firestore. That account's email/password live ONLY in
 * server-side environment variables (BAMYON_SYSTEM_EMAIL / _PASSWORD) —
 * never a NEXT_PUBLIC_ variable, never sent to the browser.
 *
 * Firestore rules then grant a narrow, explicit set of privileged writes
 * (crediting a verified deposit, flipping an order to "paid", writing an
 * audit log entry) ONLY to a request.auth.uid whose /users/{uid}.role ==
 * "system" — see the `isSystem()` rule helper.
 *
 * Setup required once per environment (documented in README.md):
 *   1. Create a Firebase Auth user for the system account (Firebase console
 *      or `firebase auth:import`), e.g. system@internal.bamyon-ims.app.
 *   2. Create its /stores/{storeId}/users/{uid} document by hand with
 *      role: "system" (this is the ONE document in the whole app that is
 *      never created via ensureUserDocument()).
 *   3. Set BAMYON_SYSTEM_EMAIL / BAMYON_SYSTEM_PASSWORD in Vercel's
 *      server-only environment variables.
 *
 * This keeps the "no service account" constraint while still giving
 * webhook/verification code a real, rules-enforced identity instead of
 * trusting whatever the browser sends.
 */
let systemAuthPromise: Promise<void> | null = null;

export async function ensureSystemAuth(): Promise<void> {
  const email = process.env.BAMYON_SYSTEM_EMAIL;
  const password = process.env.BAMYON_SYSTEM_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "BAMYON_SYSTEM_EMAIL / BAMYON_SYSTEM_PASSWORD are not set. See README.md 'System actor setup'."
    );
  }
  if (auth.currentUser?.email === email) return;
  if (!systemAuthPromise) {
    systemAuthPromise = signInWithEmailAndPassword(auth, email, password).then(() => undefined);
  }
  await systemAuthPromise;
}
