"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import { getCustomer } from "@/lib/firestore/users";
import { getWalletBalance, listLedgerForUser } from "@/lib/firestore/wallet";
import { listOrdersForUser } from "@/lib/firestore/orders";
import { useAuth } from "@/lib/auth/AuthProvider";
import { writeAuditLog } from "@/lib/firestore/audit";
import type { AppUser, CustomerStatus, Order, WalletBalance, WalletLedgerEntry } from "@/types";
import { formatMoney } from "@/lib/money";
import { Price } from "@/components/ui/Price";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";
const STATUSES: CustomerStatus[] = [
  "customer",
  "verified_customer",
  "pro_member",
  "top_member",
  "elite_member",
  "affiliate",
  "shop_owner",
];

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { appUser } = useAuth();

  const [customer, setCustomer] = useState<AppUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, o, w, l] = await Promise.all([
        getCustomer(params.id),
        listOrdersForUser(params.id),
        getWalletBalance(params.id),
        listLedgerForUser(params.id),
      ]);
      setCustomer(c);
      setOrders(o);
      setWallet(w);
      setLedger(l);
      setLoading(false);
    })();
  }, [params.id]);

  async function changeStatus(status: CustomerStatus) {
    if (!customer) return;
    await updateDoc(doc(db, "stores", STORE_ID, "users", customer.uid), { status, updatedAt: Date.now() });
    await writeAuditLog({
      actorId: appUser?.uid ?? "admin",
      action: "customer.status_change",
      targetType: "user",
      targetId: customer.uid,
      before: { status: customer.status },
      after: { status },
    });
    setCustomer({ ...customer, status });
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (!customer) return <p className="text-sm text-ink-muted">Customer not found.</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <button onClick={() => router.push("/admin/customers")} className="text-sm text-brand">
        ← Back to customers
      </button>

      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{customer.name}</h1>
        <p className="text-sm text-ink-muted">{customer.email} · {customer.phone || "no phone on file"}</p>
      </div>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Status</p>
        <select
          value={customer.status}
          onChange={(e) => changeStatus(e.target.value as CustomerStatus)}
          className="rounded-card border border-surface-muted px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-surface-muted bg-surface p-4">
          <p className="text-xs text-ink-muted">Wallet available</p>
          <Price amountMinor={wallet?.availableMinor ?? 0} currency={CURRENCY} size="lg" />
        </div>
        <div className="rounded-card border border-surface-muted bg-surface p-4">
          <p className="text-xs text-ink-muted">Orders</p>
          <p className="font-display text-2xl font-bold text-ink">{orders.length}</p>
        </div>
        <div className="rounded-card border border-surface-muted bg-surface p-4">
          <p className="text-xs text-ink-muted">Referral code</p>
          <p className="font-mono text-sm text-ink">{customer.referralCode}</p>
        </div>
      </div>

      <section className="space-y-2">
        <p className="font-semibold text-ink">Orders</p>
        {orders.length === 0 ? (
          <p className="text-sm text-ink-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between p-3 text-sm">
                <span className="text-ink">{o.orderNo}</span>
                <span className="text-ink-muted">{o.deliveryStatus} · {o.paymentStatus}</span>
                <span className="font-semibold text-ink">{formatMoney(o.totalMinor, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <p className="font-semibold text-ink">Wallet ledger</p>
        {ledger.length === 0 ? (
          <p className="text-sm text-ink-muted">No wallet activity.</p>
        ) : (
          <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between p-3 text-sm">
                <span className="text-ink">{entry.type.replace(/_/g, " ")}</span>
                <span className="font-semibold text-ink">{formatMoney(entry.amountMinor, entry.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
