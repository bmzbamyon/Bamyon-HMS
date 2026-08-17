"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listPendingCommissions, approveAffiliateEvent } from "@/lib/firestore/affiliates";
import { listPendingWithdrawals } from "@/lib/firestore/withdrawals";
import { markWithdrawalPaid } from "@/lib/firestore/wallet";
import type { AffiliateEvent, WalletLedgerEntry } from "@/types";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function AdminAffiliatesPage() {
  const { appUser } = useAuth();
  const [pendingCommissions, setPendingCommissions] = useState<AffiliateEvent[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WalletLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [commissions, withdrawals] = await Promise.all([
      listPendingCommissions(),
      listPendingWithdrawals(),
    ]);
    setPendingCommissions(commissions);
    setPendingWithdrawals(withdrawals);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Affiliates &amp; referrals</h1>
        <p className="text-sm text-ink-muted">
          Approve commissions once the merchant's return window has passed, and confirm withdrawal payouts.
        </p>
      </div>

      <section className="space-y-3">
        <p className="font-semibold text-ink">Pending commissions</p>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : pendingCommissions.length === 0 ? (
          <EmptyState title="Nothing awaiting approval." description="Affiliate sales and referral bonuses show up here once a purchase is paid." />
        ) : (
          <ul className="space-y-2">
            {pendingCommissions.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-card border border-surface-muted bg-surface p-4">
                <div className="text-sm">
                  <p className="font-medium text-ink">{formatMoney(e.commissionMinor ?? 0, CURRENCY)}</p>
                  <p className="text-xs text-ink-muted">affiliate {e.affiliateId} · order {e.orderId}</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await approveAffiliateEvent(e.id, appUser?.uid ?? "admin");
                    refresh();
                  }}
                >
                  Approve
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <p className="font-semibold text-ink">Pending withdrawals</p>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : pendingWithdrawals.length === 0 ? (
          <EmptyState title="No withdrawal requests." description="Customer payout requests appear here." />
        ) : (
          <ul className="space-y-2">
            {pendingWithdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between rounded-card border border-surface-muted bg-surface p-4">
                <div className="text-sm">
                  <p className="font-medium text-ink">{formatMoney(w.amountMinor, w.currency)}</p>
                  <p className="text-xs text-ink-muted">customer {w.userId} · ref {w.reference}</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await markWithdrawalPaid({
                      userId: w.userId,
                      amountMinor: w.amountMinor,
                      currency: w.currency,
                      reference: w.reference,
                      actorId: appUser?.uid ?? "admin",
                    });
                    refresh();
                  }}
                >
                  Mark paid
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-muted">
          Payouts happen externally via bank transfer — this only records that the transfer was sent.
        </p>
      </section>
    </div>
  );
}
