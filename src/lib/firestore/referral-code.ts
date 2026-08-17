/**
 * Deterministic, URL-safe referral code derived from a uid. Deterministic on
 * purpose: it lets ensureUserDocument() be idempotent (safe to call on every
 * sign-in) without needing a uniqueness-checking round trip on every login.
 * Collisions are astronomically unlikely at Bamyon's scale (36^7 space) but
 * if you ever need a hard uniqueness guarantee, enforce it with a
 * `referralCodes/{code}` reservation document + a Firestore transaction.
 */
export function generateReferralCode(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
}
