import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { PaymentRecord } from "@/types";

const paymentsCol = () => collection(db, "stores", STORE_ID, "payments");

export async function createPendingPayment(
  input: Omit<PaymentRecord, "id" | "storeId" | "status" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(paymentsCol());
  await setDoc(ref, {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function markPaymentVerified(
  paymentId: string,
  verifiedByStaffId?: string
): Promise<void> {
  await updateDoc(doc(paymentsCol(), paymentId), {
    status: "verified",
    verifiedByStaffId: verifiedByStaffId ?? "system",
    verifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markPaymentFailed(paymentId: string): Promise<void> {
  await updateDoc(doc(paymentsCol(), paymentId), { status: "failed", updatedAt: serverTimestamp() });
}

export async function findPaymentByReference(reference: string): Promise<PaymentRecord | null> {
  const q = query(paymentsCol(), where("reference", "==", reference), fsLimit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0]!.data() as PaymentRecord;
}

/** Customer's own pending bank transfers + Paystack history, most recent first. */
export async function listPaymentsForUser(userId: string): Promise<PaymentRecord[]> {
  const q = query(
    paymentsCol(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    fsLimit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PaymentRecord);
}

/** Admin/finance queue — pending bank transfers awaiting manual verification. */
export async function listPendingBankTransfers(): Promise<PaymentRecord[]> {
  const q = query(
    paymentsCol(),
    where("provider", "==", "bank_transfer"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    fsLimit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PaymentRecord);
}
