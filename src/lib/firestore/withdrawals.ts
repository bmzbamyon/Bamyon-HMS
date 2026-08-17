import { collection, getDocs, limit as fsLimit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { WalletLedgerEntry } from "@/types";

const ledgerCol = () => collection(db, "stores", STORE_ID, "walletLedger");

/**
 * The wallet ledger is append-only (see wallet.ts) — a `withdrawal_pending`
 * entry never gets edited in place when it's paid out. Instead,
 * markWithdrawalPaid() writes a NEW `withdrawal_paid` entry with the same
 * `reference`. So "still pending" means: a withdrawal_pending entry whose
 * reference has no matching withdrawal_paid entry yet.
 */
export async function listPendingWithdrawals(): Promise<WalletLedgerEntry[]> {
  const [pendingSnap, paidSnap] = await Promise.all([
    getDocs(query(ledgerCol(), where("type", "==", "withdrawal_pending"), orderBy("createdAt", "desc"), fsLimit(200))),
    getDocs(query(ledgerCol(), where("type", "==", "withdrawal_paid"), fsLimit(500))),
  ]);
  const paidReferences = new Set(paidSnap.docs.map((d) => (d.data() as WalletLedgerEntry).reference));
  return pendingSnap.docs
    .map((d) => d.data() as WalletLedgerEntry)
    .filter((entry) => !paidReferences.has(entry.reference));
}
