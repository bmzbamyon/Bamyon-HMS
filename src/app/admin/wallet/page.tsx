"use client";

import { useEffect, useState } from "react";
import { listPendingBankTransfers, markPaymentVerified, markPaymentFailed } from "@/lib/firestore/payments";
import { creditVerifiedDeposit, adjustWallet } from "@/lib/firestore/wallet";
import { writeAuditLog } from "@/lib/firestore/audit";
import { logError } from "@/lib/firestore/errorLog";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { PaymentRecord } from "@/types";
import { formatMoney, toMinorUnits } from "@/lib/money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function AdminWalletPage() {
  const { appUser } = useAuth();
  const [transfers, setTransfers] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState<string | null>(null);

  async function refresh() {
    setTransfers(await listPendingBankTransfers());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function approve(payment: PaymentRecord) {
    await markPaymentVerified(payment.id, appUser?.uid);
    await creditVerifiedDeposit({
      userId: payment.userId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      paymentReference: payment.reference,
      actorId: appUser?.uid ?? "admin",
    });
    refresh();
  }

  async function reject(payment: PaymentRecord) {
    await markPaymentFailed(payment.id);
    refresh();
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    setAdjustMessage(null);
    setAdjusting(true);
    try {
      const amountMinor = toMinorUnits(Number(adjustAmount), CURRENCY);
      await adjustWallet({
        userId: adjustUserId,
        amountMinor,
        currency: CURRENCY,
        reason: adjustReason,
        actorId: appUser.uid,
      });
      await writeAuditLog({
        actorId: appUser.uid,
        action: "wallet.adjustment",
        targetType: "user",
        targetId: adjustUserId,
        after: { amountMinor, reason: adjustReason },
      });
      setAdjustMessage("Adjustment recorded.");
      setAdjustUserId("");
      setAdjustAmount("");
      setAdjustReason("");
    } catch (err) {
      setAdjustMessage(err instanceof Error ? err.message : "Could not apply adjustment.");
      logError({ error: err, context: "admin.wallet.adjustWallet", userId: appUser?.uid });
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Wallet &amp; finance</h1>
        <p className="text-sm text-ink-muted">
          Deposits, transfer verification, ledger and manual corrections. Every write here is an append-only
          ledger entry — balances are never edited directly.
        </p>
      </div>

      <section className="space-y-3">
        <p className="font-semibold text-ink">Pending bank transfers</p>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : transfers.length === 0 ? (
          <EmptyState title="Nothing awaiting verification." description="Customer bank transfer claims will appear here." />
        ) : (
          <ul className="space-y-3">
            {transfers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-surface-muted bg-surface p-4">
                <div>
                  <p className="font-medium text-ink">{formatMoney(t.amountMinor, t.currency)}</p>
                  <p className="text-xs text-ink-muted">ref {t.reference} · customer {t.userId}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve(t)}>Verify &amp; credit</Button>
                  <Button size="sm" variant="danger" onClick={() => reject(t)}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="max-w-md space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Manual wallet adjustment</p>
        <p className="text-xs text-ink-muted">
          A reason is required and every adjustment is written to the audit log alongside your staff ID.
        </p>
        <form onSubmit={submitAdjustment} className="space-y-2">
          <input
            required
            placeholder="Customer user ID"
            value={adjustUserId}
            onChange={(e) => setAdjustUserId(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            placeholder="Amount (use a negative number to deduct)"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Reason (required, audited)"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          {adjustMessage ? <p className="text-sm text-ink-muted">{adjustMessage}</p> : null}
          <Button type="submit" size="sm" loading={adjusting}>Apply adjustment</Button>
        </form>
      </section>
    </div>
  );
}
