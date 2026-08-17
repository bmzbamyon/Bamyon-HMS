import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { LedgerEntryType, WalletBalance, WalletLedgerEntry } from "@/types";
import { InsufficientWalletBalanceError } from "@/lib/firestore/errors";

const ledgerCol = () => collection(db, "stores", STORE_ID, "walletLedger");
const balanceRef = (userId: string) => doc(db, "stores", STORE_ID, "walletBalances", userId);

/**
 * The wallet balance document is a CACHE, recomputed inside the same
 * transaction as every ledger write below. It exists purely so the UI can
 * read one document instead of summing the whole ledger on every page load.
 * Nothing outside this file should ever `setDoc`/`updateDoc` a walletBalances
 * document directly — Firestore rules also enforce this (writes to
 * walletBalances are rules-denied for all client roles).
 */
async function applyLedgerEntry(
  userId: string,
  entry: {
    type: LedgerEntryType;
    amountMinor: number;
    currency: string;
    reference: string;
    actorId: string;
    status: WalletLedgerEntry["status"];
    reason?: string;
  }
): Promise<string> {
  const entryRef = doc(ledgerCol());
  const balRef = balanceRef(userId);

  await runTransaction(db, async (tx) => {
    const balSnap = await tx.get(balRef);
    const current: WalletBalance = balSnap.exists()
      ? (balSnap.data() as WalletBalance)
      : {
          storeId: STORE_ID,
          userId,
          currency: entry.currency,
          availableMinor: 0,
          reservedMinor: 0,
          pendingMinor: 0,
          updatedAt: Date.now(),
        };

    let { availableMinor, reservedMinor, pendingMinor } = current;

    switch (entry.type) {
      case "credit_deposit":
      case "refund":
        availableMinor += entry.amountMinor;
        break;
      case "commission_approved":
        // Moves a sum OUT of pending (where commission_pending put it) and
        // INTO available — never just adds, or pendingMinor would drift
        // upward forever every time a commission is approved.
        pendingMinor -= entry.amountMinor;
        availableMinor += entry.amountMinor;
        break;
      case "withdrawal_paid":
        // Clears the amount that was moved into pending by
        // withdrawal_pending — funds already left available at that step.
        pendingMinor -= entry.amountMinor;
        break;
      case "debit_purchase":
        if (availableMinor < entry.amountMinor) {
          throw new InsufficientWalletBalanceError();
        }
        availableMinor -= entry.amountMinor;
        break;
      case "reserve_order":
        if (availableMinor < entry.amountMinor) {
          throw new InsufficientWalletBalanceError();
        }
        availableMinor -= entry.amountMinor;
        reservedMinor += entry.amountMinor;
        break;
      case "release_reservation":
        reservedMinor -= entry.amountMinor;
        availableMinor += entry.amountMinor;
        break;
      case "commission_pending":
        // Normally positive (a new pending commission). A REVERSAL (order
        // cancelled/returned before the commission was approved) calls this
        // with a negative amountMinor to remove it from pending again — see
        // reverseCommission() in affiliates.ts. This is the one ledger type
        // where the caller may pass a signed value; every other type is
        // always positive, with `type` alone determining the effect.
        pendingMinor += entry.amountMinor;
        break;
      case "withdrawal_pending":
        if (availableMinor < entry.amountMinor) {
          throw new InsufficientWalletBalanceError();
        }
        availableMinor -= entry.amountMinor;
        pendingMinor += entry.amountMinor;
        break;
      case "adjustment":
        // `amountMinor` may represent a positive or negative correction —
        // callers encode direction via `reason` and the admin UI requires it.
        availableMinor += entry.amountMinor;
        break;
    }

    tx.set(entryRef, {
      id: entryRef.id,
      storeId: STORE_ID,
      userId,
      type: entry.type,
      amountMinor: entry.amountMinor,
      currency: entry.currency,
      reference: entry.reference,
      status: entry.status,
      actorId: entry.actorId,
      reason: entry.reason ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(balRef, {
      storeId: STORE_ID,
      userId,
      currency: entry.currency,
      availableMinor,
      reservedMinor,
      pendingMinor,
      updatedAt: serverTimestamp(),
    });
  });

  return entryRef.id;
}

/** Reserves wallet funds against a just-created order (see orders.ts placeOrder). */
export async function reserveWalletFunds(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  orderId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "reserve_order",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.orderId,
    actorId: params.userId,
    status: "pending",
  });
}

/** Converts a reservation into a completed debit once the order is confirmed paid. */
export async function settleWalletPurchase(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  orderId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "release_reservation",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.orderId,
    actorId: params.userId,
    status: "settled",
  });
  await applyLedgerEntry(params.userId, {
    type: "debit_purchase",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.orderId,
    actorId: params.userId,
    status: "settled",
  });
}

/**
 * Credits a deposit. Callers MUST have already server-verified the payment —
 * see app/api/wallet/verify-paystack (Paystack) or the admin bank-transfer
 * confirmation flow (staff with `wallet.verify`, itself gated by Firestore
 * rules requiring a matching staffProfiles permission).
 */
export async function creditVerifiedDeposit(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  paymentReference: string;
  actorId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "credit_deposit",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.paymentReference,
    actorId: params.actorId,
    status: "settled",
  });
}

/** Staff/admin correction. `reason` is mandatory and every call is written to auditLogs by the caller. */
export async function adjustWallet(params: {
  userId: string;
  amountMinor: number; // signed
  currency: string;
  reason: string;
  actorId: string;
}): Promise<void> {
  if (!params.reason.trim()) throw new Error("An adjustment reason is required.");
  await applyLedgerEntry(params.userId, {
    type: "adjustment",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: `manual:${params.actorId}`,
    actorId: params.actorId,
    status: "settled",
    reason: params.reason,
  });
}

/**
 * Peer-to-peer transfer. Only ever called from app/api/wallet/transfer —
 * NEVER exposed to a plain client component — because it debits one user
 * and credits another, which requires the trusted system actor (see
 * systemAuth.ts) rather than the narrower same-user rules that cover
 * everything else in this file. The route verifies the sender's ID token
 * first (see lib/firebase/verifyIdToken.ts) so "who is sending" is never
 * taken from an unverified request body.
 */
export async function transferBetweenUsers(params: {
  senderUid: string;
  senderName: string;
  recipientUid: string;
  recipientName: string;
  amountMinor: number;
  currency: string;
}): Promise<void> {
  if (params.amountMinor <= 0) throw new Error("Transfer amount must be positive.");
  if (params.senderUid === params.recipientUid) {
    throw new Error("You can't transfer money to yourself.");
  }
  const reference = `transfer:${params.senderUid}:${Date.now()}`;

  await applyLedgerEntry(params.senderUid, {
    type: "debit_purchase",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference,
    actorId: params.senderUid,
    status: "settled",
    reason: `Transfer to ${params.recipientName}`,
  });

  await applyLedgerEntry(params.recipientUid, {
    type: "credit_deposit",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference,
    actorId: params.senderUid,
    status: "settled",
    reason: `Transfer from ${params.senderName}`,
  });
}

/** Credits a refund back to the customer's wallet as spendable balance. */
export async function creditRefund(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  actorId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "refund",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.reference,
    actorId: params.actorId,
    status: "settled",
  });
}

/** Direct debit for a POS sale paid via wallet — staff-initiated, no prior reservation. */
export async function debitWalletForPosSale(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  actorId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "debit_purchase",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.reference,
    actorId: params.actorId,
    status: "settled",
  });
}

export async function getWalletBalance(userId: string): Promise<WalletBalance | null> {
  const snap = await getDoc(balanceRef(userId));
  return snap.exists() ? (snap.data() as WalletBalance) : null;
}

/** Records a new pending affiliate/referral commission — see affiliates.ts and referrals.ts. */
export async function creditCommissionPending(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  actorId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "commission_pending",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.reference,
    actorId: params.actorId,
    status: "pending",
  });
}

/** Reverses a not-yet-approved commission (order cancelled/returned) — see affiliates.ts. */
export async function reverseCommissionPending(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  actorId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "commission_pending",
    amountMinor: -params.amountMinor,
    currency: params.currency,
    reference: params.reference,
    actorId: params.actorId,
    status: "reversed",
  });
}

/** Moves a pending commission into available balance once the merchant's return window passes. */
export async function approveCommission(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  actorId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "commission_approved",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.reference,
    actorId: params.actorId,
    status: "settled",
  });
}

/** Customer requests a payout — moves available funds into pending until admin pays it out. */
export async function requestWithdrawal(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  reference: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "withdrawal_pending",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.reference,
    actorId: params.userId,
    status: "pending",
  });
}

/** Admin confirms a withdrawal has actually been paid out via bank transfer. */
export async function markWithdrawalPaid(params: {
  userId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  actorId: string;
}): Promise<void> {
  await applyLedgerEntry(params.userId, {
    type: "withdrawal_paid",
    amountMinor: params.amountMinor,
    currency: params.currency,
    reference: params.reference,
    actorId: params.actorId,
    status: "settled",
  });
}

export async function listLedgerForUser(userId: string): Promise<WalletLedgerEntry[]> {
  const q = query(
    ledgerCol(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    fsLimit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as WalletLedgerEntry);
}
