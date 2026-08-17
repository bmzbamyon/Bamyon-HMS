"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getWalletBalance, listLedgerForUser, requestWithdrawal } from "@/lib/firestore/wallet";
import type { WalletBalance, WalletLedgerEntry } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toMinorUnits } from "@/lib/money";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

const LEDGER_LABEL: Record<WalletLedgerEntry["type"], string> = {
  credit_deposit: "Deposit",
  debit_purchase: "Purchase",
  reserve_order: "Order hold",
  release_reservation: "Hold released",
  refund: "Refund",
  commission_pending: "Commission (pending)",
  commission_approved: "Commission (approved)",
  withdrawal_pending: "Withdrawal requested",
  withdrawal_paid: "Withdrawal paid",
  adjustment: "Adjustment",
};

function WalletPageContent() {
  const { firebaseUser } = useAuth();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("5000");
  const [startingTopUp, setStartingTopUp] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  async function refresh(uid: string) {
    const [bal, entries] = await Promise.all([getWalletBalance(uid), listLedgerForUser(uid)]);
    setBalance(bal);
    setLedger(entries);
    setLoading(false);
  }

  useEffect(() => {
    if (!firebaseUser) return;
    refresh(firebaseUser.uid);
  }, [firebaseUser]);

  // If we landed back here from Paystack with ?ref=..., verify it now
  // instead of waiting on the webhook — see app/api/wallet/verify-paystack.
  useEffect(() => {
    if (!ref || !firebaseUser) return;
    (async () => {
      setVerifyStatus("Verifying payment…");
      const res = await fetch(`/api/wallet/verify-paystack?ref=${ref}`);
      const json = await res.json();
      setVerifyStatus(
        json.status === "success"
          ? "Deposit confirmed and credited."
          : json.alreadyProcessed
          ? "This payment was already processed."
          : "Payment could not be verified."
      );
      refresh(firebaseUser.uid);
    })();
  }, [ref, firebaseUser]);

  if (!firebaseUser) {
    return (
      <div className="text-center">
        <a href="/login?next=/wallet" className="font-medium text-brand">Sign in to view your wallet</a>
      </div>
    );
  }

  async function startTopUp() {
    setStartingTopUp(true);
    try {
      const amountMinor = toMinorUnits(Number(topUpAmount), CURRENCY);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: firebaseUser!.uid,
          email: firebaseUser!.email,
          amountMinor,
          currency: CURRENCY,
          purpose: "wallet_topup",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = json.authorizationUrl;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not start top-up.");
    } finally {
      setStartingTopUp(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-ink">Wallet</h1>

      {verifyStatus ? (
        <p className="rounded-card bg-brand-light p-3 text-sm text-brand-dark">{verifyStatus}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <BalanceCard label="Available" amountMinor={balance?.availableMinor ?? 0} />
        <BalanceCard label="Reserved" amountMinor={balance?.reservedMinor ?? 0} />
        <BalanceCard label="Pending" amountMinor={balance?.pendingMinor ?? 0} />
      </div>

      <section className="max-w-sm space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Top up via Paystack</p>
        <input
          type="number"
          min={100}
          value={topUpAmount}
          onChange={(e) => setTopUpAmount(e.target.value)}
          className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
        />
        <Button onClick={startTopUp} loading={startingTopUp} className="w-full">
          Fund wallet
        </Button>
      </section>

      <TransferByEmail onDone={() => refresh(firebaseUser.uid)} />

      <WithdrawalRequest balance={balance} onDone={() => refresh(firebaseUser.uid)} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">Transaction history</h2>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : ledger.length === 0 ? (
          <EmptyState title="No wallet activity yet." description="Deposits and purchases will appear here." />
        ) : (
          <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium text-ink">{LEDGER_LABEL[entry.type]}</p>
                  <p className="text-xs text-ink-muted">{entry.status} · ref {entry.reference}</p>
                </div>
                <Price amountMinor={entry.amountMinor} currency={entry.currency} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BalanceCard({ label, amountMinor }: { label: string; amountMinor: number }) {
  return (
    <div className="rounded-card border border-surface-muted bg-surface p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="mt-1">
        <Price amountMinor={amountMinor} currency={CURRENCY} size="lg" />
      </div>
    </div>
  );
}

function TransferByEmail({ onDone }: { onDone: () => void }) {
  const { firebaseUser } = useAuth();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState<{ uid: string; name: string; photoUrl: string | null } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function resolveRecipient() {
    if (!firebaseUser) return;
    setError(null);
    setSuccess(null);
    setResolving(true);
    setRecipient(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(`/api/wallet/transfer?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRecipient(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that customer.");
    } finally {
      setResolving(false);
    }
  }

  async function confirmTransfer() {
    if (!firebaseUser || !recipient) return;
    setSending(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          recipientUid: recipient.uid,
          recipientName: recipient.name,
          amountMinor: toMinorUnits(Number(amount), CURRENCY),
          currency: CURRENCY,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess(`Sent to ${recipient.name}.`);
      setRecipient(null);
      setEmail("");
      setAmount("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="max-w-sm space-y-3 rounded-card border border-surface-muted bg-surface p-5">
      <p className="font-semibold text-ink">Transfer by email</p>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="Recipient email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setRecipient(null);
          }}
          className="flex-1 rounded-card border border-surface-muted px-3 py-2 text-sm"
        />
        <Button size="sm" variant="ghost" onClick={resolveRecipient} loading={resolving}>
          Find
        </Button>
      </div>

      {recipient ? (
        <div className="space-y-2 rounded-card bg-surface-muted p-3">
          <p className="text-sm text-ink">
            Sending to <span className="font-semibold">{recipient.name}</span>
          </p>
          <input
            type="number"
            placeholder={`Amount (${CURRENCY})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={confirmTransfer} loading={sending} disabled={!amount}>
            Confirm transfer
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-brand">{success}</p> : null}
    </section>
  );
}

function WithdrawalRequest({ balance, onDone }: { balance: WalletBalance | null; onDone: () => void }) {
  const { firebaseUser, appUser } = useAuth();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasBankDetails = !!appUser?.bankDetails;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const amountMinor = toMinorUnits(Number(amount), CURRENCY);
      if (!balance || balance.availableMinor < amountMinor) {
        throw new Error("You don't have enough available balance for this withdrawal.");
      }
      await requestWithdrawal({
        userId: firebaseUser.uid,
        amountMinor,
        currency: CURRENCY,
        reference: `withdrawal:${firebaseUser.uid}:${Date.now()}`,
      });
      setMessage("Withdrawal requested — our team will process it within 24 hours.");
      setAmount("");
      onDone();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not submit withdrawal request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="max-w-sm space-y-3 rounded-card border border-surface-muted bg-surface p-5">
      <p className="font-semibold text-ink">Request a withdrawal</p>
      {!hasBankDetails ? (
        <p className="text-sm text-ink-muted">
          Add your bank details in <a href="/account" className="text-brand">your profile</a> before requesting a
          withdrawal.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <input
            required
            type="number"
            placeholder={`Amount (${CURRENCY})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <p className="text-xs text-ink-muted">Paid out to your saved bank account, typically within 24 hours.</p>
          <Button type="submit" size="sm" loading={submitting}>Request withdrawal</Button>
        </form>
      )}
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </section>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletPageContent />
    </Suspense>
  );
}
