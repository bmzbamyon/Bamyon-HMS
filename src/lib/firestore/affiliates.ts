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
import type { Affiliate, AffiliateEvent, Product } from "@/types";
import { percentOfMinor } from "@/lib/money";
import { creditCommissionPending, reverseCommissionPending, approveCommission } from "@/lib/firestore/wallet";

const affiliatesCol = () => collection(db, "stores", STORE_ID, "affiliates");
const affiliateEventsCol = () => collection(db, "stores", STORE_ID, "affiliateEvents");

function generateAffiliateCode(uid: string): string {
  return `AFF-${uid.slice(0, 6).toUpperCase()}`;
}

/** Creates an affiliate account for a customer if they don't already have one. Idempotent. */
export async function ensureAffiliateAccount(userId: string): Promise<Affiliate> {
  const existing = await getAffiliateForUser(userId);
  if (existing) return existing;

  const ref = doc(affiliatesCol(), userId); // one affiliate doc per user, id == uid
  const affiliate: Omit<Affiliate, "createdAt" | "updatedAt"> = {
    id: userId,
    storeId: STORE_ID,
    userId,
    code: generateAffiliateCode(userId),
    status: "active",
  };
  await setDoc(ref, { ...affiliate, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { ...affiliate, createdAt: Date.now(), updatedAt: Date.now() };
}

export async function getAffiliateForUser(userId: string): Promise<Affiliate | null> {
  const snap = await getDoc(doc(affiliatesCol(), userId));
  return snap.exists() ? (snap.data() as Affiliate) : null;
}

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  const q = query(affiliatesCol(), where("code", "==", code), fsLimit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0]!.data() as Affiliate);
}

/** Fired when someone lands on a product page via an affiliate link (?ref=CODE). Fire-and-forget. */
export async function recordAffiliateClick(affiliateId: string, productId: string): Promise<void> {
  const ref = doc(affiliateEventsCol());
  await setDoc(ref, {
    id: ref.id,
    storeId: STORE_ID,
    affiliateId,
    productId,
    type: "click",
    status: "clicked",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Called from markOrderPaid() (orders.ts) once a payment is confirmed.
 * Computes commission from the PRODUCT's own configured rate — never from
 * anything the client submitted at checkout — and records it as pending
 * until the merchant's return window passes (see approveAffiliateCommission
 * / the admin affiliate console).
 */
export async function creditAffiliateConversion(params: {
  affiliateId: string;
  orderId: string;
  product: Product;
  lineTotalMinor: number;
  currency: string;
}): Promise<void> {
  if (!params.product.affiliateEnabled || !params.product.affiliateCommission) return;

  const commission = params.product.affiliateCommission;
  const commissionMinor =
    commission.type === "percent"
      ? percentOfMinor(params.lineTotalMinor, commission.value)
      : commission.value;
  if (commissionMinor <= 0) return;

  const affiliate = await getDoc(doc(affiliatesCol(), params.affiliateId));
  if (!affiliate.exists()) return;
  const affiliateUserId = (affiliate.data() as Affiliate).userId;

  const eventRef = doc(affiliateEventsCol());
  await setDoc(eventRef, {
    id: eventRef.id,
    storeId: STORE_ID,
    affiliateId: params.affiliateId,
    productId: params.product.id,
    orderId: params.orderId,
    type: "conversion",
    commissionMinor,
    status: "commission_pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await creditCommissionPending({
    userId: affiliateUserId,
    amountMinor: commissionMinor,
    currency: params.currency,
    reference: `affiliate-event:${eventRef.id}`,
    actorId: "system",
  });
}

/** Called from cancelOrder()/refund flows to reverse any not-yet-approved commission tied to that order. */
export async function reverseAffiliateConversionsForOrder(orderId: string): Promise<void> {
  const q = query(
    affiliateEventsCol(),
    where("orderId", "==", orderId),
    where("status", "==", "commission_pending")
  );
  const snap = await getDocs(q);
  for (const eventDoc of snap.docs) {
    const event = eventDoc.data() as AffiliateEvent;
    const affiliate = await getDoc(doc(affiliatesCol(), event.affiliateId));
    if (!affiliate.exists() || !event.commissionMinor) continue;
    await reverseCommissionPending({
      userId: (affiliate.data() as Affiliate).userId,
      amountMinor: event.commissionMinor,
      currency: "NGN",
      reference: `affiliate-event:${event.id}`,
      actorId: "system",
    });
    await setDoc(eventDoc.ref, { status: "reversed", updatedAt: serverTimestamp() }, { merge: true });
  }
}

/** Admin: approve a pending commission after the merchant's return window passes. */
export async function approveAffiliateEvent(eventId: string, actorId: string): Promise<void> {
  const eventSnap = await getDoc(doc(affiliateEventsCol(), eventId));
  if (!eventSnap.exists()) throw new Error("Affiliate event not found.");
  const event = eventSnap.data() as AffiliateEvent;
  if (event.status !== "commission_pending" || !event.commissionMinor) return;

  const affiliate = await getDoc(doc(affiliatesCol(), event.affiliateId));
  if (!affiliate.exists()) return;

  await approveCommission({
    userId: (affiliate.data() as Affiliate).userId,
    amountMinor: event.commissionMinor,
    currency: "NGN",
    reference: `affiliate-event:${eventId}`,
    actorId,
  });
  await setDoc(eventSnap.ref, { status: "commission_approved", updatedAt: serverTimestamp() }, { merge: true });
}

export async function listAffiliateEventsForAffiliate(affiliateId: string): Promise<AffiliateEvent[]> {
  const q = query(
    affiliateEventsCol(),
    where("affiliateId", "==", affiliateId),
    orderBy("createdAt", "desc"),
    fsLimit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AffiliateEvent);
}

/** Admin console: every commission awaiting approval, across all affiliates. */
export async function listPendingCommissions(): Promise<AffiliateEvent[]> {
  const q = query(
    affiliateEventsCol(),
    where("status", "==", "commission_pending"),
    orderBy("createdAt", "desc"),
    fsLimit(200)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AffiliateEvent);
}
