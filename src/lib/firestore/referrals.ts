import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { AppUser, Referral } from "@/types";
import { creditCommissionPending, approveCommission } from "@/lib/firestore/wallet";
import { toMinorUnits } from "@/lib/money";

const referralsCol = () => collection(db, "stores", STORE_ID, "referrals");
const usersCol = () => collection(db, "stores", STORE_ID, "users");

// Admin-configurable in a future iteration via /stores/{storeId}.featureFlags
// or a dedicated settings doc — the build brief's default (section 30).
const DEFAULT_REFERRAL_BONUS_MINOR = toMinorUnits(100, "NGN");

/**
 * Called once, at signup, if the new user was referred (AuthProvider passes
 * `referredBy` through to the user doc — see ensureUserDocument). Creates a
 * `pending` referral record; the bonus itself isn't credited until the
 * referee completes a qualifying purchase (see
 * creditReferralOnQualifyingOrder below) — the build brief is explicit that
 * unqualified referrals should not be immediately withdrawable.
 */
export async function createPendingReferral(referrerId: string, refereeId: string): Promise<void> {
  const ref = doc(referralsCol());
  await setDoc(ref, {
    id: ref.id,
    storeId: STORE_ID,
    referrerId,
    refereeId,
    rewardMinor: DEFAULT_REFERRAL_BONUS_MINOR,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Called from markOrderPaid() (orders.ts) for every paid order. Looks for a
 * still-pending referral where this buyer is the referee; if this is their
 * qualifying purchase, moves the referral to `qualified` and credits the
 * referrer's wallet as a pending commission (mirrors the affiliate flow —
 * an admin can later approve it into available balance, or it can be
 * auto-approved immediately depending on the merchant's risk tolerance;
 * phase 2-5 always requires the explicit admin approval step below for
 * consistency with the affiliate console).
 */
export async function creditReferralOnQualifyingOrder(refereeId: string, orderId: string): Promise<void> {
  const q = query(
    referralsCol(),
    where("refereeId", "==", refereeId),
    where("status", "==", "pending"),
    fsLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const referralDoc = snap.docs[0]!;
  const referral = referralDoc.data() as Referral;

  await setDoc(referralDoc.ref, { status: "qualified", updatedAt: serverTimestamp() }, { merge: true });

  await creditCommissionPending({
    userId: referral.referrerId,
    amountMinor: referral.rewardMinor,
    currency: "NGN",
    reference: `referral:${referral.id}:order:${orderId}`,
    actorId: "system",
  });

  await setDoc(referralDoc.ref, { status: "approved", updatedAt: serverTimestamp() }, { merge: true });
}

/** Admin: release an approved referral's reward from pending into withdrawable/available balance. */
export async function releaseReferralReward(referralId: string, actorId: string): Promise<void> {
  const snap = await getDoc(doc(referralsCol(), referralId));
  if (!snap.exists()) throw new Error("Referral not found.");
  const referral = snap.data() as Referral;
  if (referral.status !== "approved") return;

  await approveCommission({
    userId: referral.referrerId,
    amountMinor: referral.rewardMinor,
    currency: "NGN",
    reference: `referral:${referral.id}`,
    actorId,
  });
  await setDoc(snap.ref, { status: "withdrawable", updatedAt: serverTimestamp() }, { merge: true });
}

export async function listReferralsForUser(referrerId: string): Promise<Referral[]> {
  const q = query(
    referralsCol(),
    where("referrerId", "==", referrerId),
    orderBy("createdAt", "desc"),
    fsLimit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Referral);
}

export async function findUserByReferralCode(code: string): Promise<AppUser | null> {
  const q = query(usersCol(), where("referralCode", "==", code), fsLimit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0]!.data() as AppUser);
}
