"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ensureAffiliateAccount, listAffiliateEventsForAffiliate } from "@/lib/firestore/affiliates";
import { getWalletBalance } from "@/lib/firestore/wallet";
import type { Affiliate, AffiliateEvent, WalletBalance } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { addMinor } from "@/lib/money";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function AffiliatePage() {
  const { firebaseUser } = useAuth();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [events, setEvents] = useState<AffiliateEvent[]>([]);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      const acct = await ensureAffiliateAccount(firebaseUser.uid);
      setAffiliate(acct);
      const [evts, bal] = await Promise.all([
        listAffiliateEventsForAffiliate(acct.id),
        getWalletBalance(firebaseUser.uid),
      ]);
      setEvents(evts);
      setWallet(bal);
      setLoading(false);
    })();
  }, [firebaseUser]);

  if (!firebaseUser) {
    return (
      <div className="text-center">
        <a href="/login?next=/affiliate" className="font-medium text-brand">Sign in to access affiliate tools</a>
      </div>
    );
  }

  if (loading || !affiliate) return <p className="text-sm text-ink-muted">Loading…</p>;

  const clicks = events.filter((e) => e.type === "click").length;
  const conversions = events.filter((e) => e.type === "conversion");
  const pendingCommission = addMinor(
    ...conversions.filter((e) => e.status === "commission_pending").map((e) => e.commissionMinor ?? 0)
  );
  const approvedCommission = addMinor(
    ...conversions.filter((e) => e.status === "commission_approved").map((e) => e.commissionMinor ?? 0)
  );

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/shop?ref=${affiliate.code}` : "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Affiliate center</h1>
        <p className="text-sm text-ink-muted">Share products, earn commission on eligible sales.</p>
      </div>

      <section className="space-y-2 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Your affiliate link</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-surface-muted px-3 py-2 text-sm">{shareUrl}</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
        </div>
        <p className="text-xs text-ink-muted">
          Add it to a specific product page too — visit any product and append{" "}
          <code className="rounded bg-surface-muted px-1">?ref={affiliate.code}</code> to the URL.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatBox label="Clicks" value={String(clicks)} />
        <StatBox label="Conversions" value={String(conversions.length)} />
        <StatBox label="Pending commission" value={<Price amountMinor={pendingCommission} currency={CURRENCY} size="sm" />} />
        <StatBox label="Approved commission" value={<Price amountMinor={approvedCommission} currency={CURRENCY} size="sm" />} />
      </div>

      <section className="space-y-3">
        <p className="font-semibold text-ink">Activity</p>
        {events.length === 0 ? (
          <EmptyState title="No affiliate activity yet." description="Clicks and sales through your link will appear here." />
        ) : (
          <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-3 text-sm">
                <span className="capitalize text-ink">{e.type} · {e.status.replace(/_/g, " ")}</span>
                {e.commissionMinor ? <Price amountMinor={e.commissionMinor} currency={CURRENCY} size="sm" /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-card border border-surface-muted bg-surface p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <div className="mt-1 font-display font-bold text-ink">{value}</div>
    </div>
  );
}
