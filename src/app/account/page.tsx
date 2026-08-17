"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth/AuthProvider";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import { getWalletBalance } from "@/lib/firestore/wallet";
import { listOrdersForUser } from "@/lib/firestore/orders";
import { saveAddress, removeAddress, generateAddressId } from "@/lib/firestore/addresses";
import { listReferralsForUser } from "@/lib/firestore/referrals";
import type { WalletBalance, Order, Address, Referral } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function AccountPage() {
  const { firebaseUser, appUser, signOutUser } = useAuth();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    getWalletBalance(firebaseUser.uid).then(setWallet);
    listOrdersForUser(firebaseUser.uid).then(setOrders);
    listReferralsForUser(firebaseUser.uid).then(setReferrals);
  }, [firebaseUser]);

  useEffect(() => {
    if (appUser) {
      setName(appUser.name ?? "");
      setPhone(appUser.phone ?? "");
      setWhatsapp(appUser.whatsapp ?? "");
      setBankName(appUser.bankDetails?.bankName ?? "");
      setAccountNumber(appUser.bankDetails?.accountNumber ?? "");
      setAccountName(appUser.bankDetails?.accountName ?? "");
    }
  }, [appUser]);

  if (!firebaseUser || !appUser) {
    return (
      <div className="text-center">
        <a href="/login?next=/account" className="font-medium text-brand">Sign in to view your dashboard</a>
      </div>
    );
  }

  const activeOrders = orders.filter(
    (o) => !["delivered", "completed", "cancelled", "issue"].includes(o.deliveryStatus)
  );

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Nigerian WhatsApp numbers may begin with 234; otherwise validate as
      // a generic +countrycode number so international customers aren't
      // unnecessarily blocked (build doc section 20).
      const cleanedWhatsapp = whatsapp.trim();
      if (cleanedWhatsapp && !/^(\+?234|\+?[1-9]\d{6,14})$/.test(cleanedWhatsapp.replace(/[\s-]/g, ""))) {
        alert("Please enter a valid WhatsApp number, including country code.");
        setSaving(false);
        return;
      }
      await updateDoc(doc(db, "stores", STORE_ID, "users", firebaseUser.uid), {
        name,
        phone,
        whatsapp: cleanedWhatsapp,
        bankDetails:
          bankName && accountNumber && accountName
            ? { bankName, accountNumber, accountName }
            : null,
        updatedAt: Date.now(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Welcome back, {appUser.name}</h1>
        <Button variant="ghost" size="sm" onClick={() => signOutUser()}>Sign out</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <DashCard label="Wallet" value={<Price amountMinor={wallet?.availableMinor ?? 0} currency={CURRENCY} size="lg" />} hint="available" />
        <DashCard label="Active orders" value={<span className="font-display text-2xl font-bold">{activeOrders.length}</span>} />
        <DashCard label="Account status" value={<span className="font-display text-lg font-bold capitalize">{appUser.status.replace("_", " ")}</span>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <p className="font-semibold text-ink">Quick links</p>
          <div className="flex flex-col gap-2 text-sm">
            <a href="/orders" className="text-brand hover:underline">View orders →</a>
            <a href="/wallet" className="text-brand hover:underline">Manage wallet →</a>
            <a href="/shop" className="text-brand hover:underline">Continue shopping →</a>
          </div>
        </section>

        <form onSubmit={saveProfile} className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <p className="font-semibold text-ink">Profile</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="WhatsApp number (with country code)"
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Bank details (for affiliate/referral withdrawals)
          </p>
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank name"
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Account number"
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Account holder name"
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm" loading={saving}>
            {saved ? "Profile updated successfully." : "Save changes"}
          </Button>
        </form>
      </div>

      <section className="space-y-3">
        <p className="font-semibold text-ink">Referral code</p>
        <p className="text-sm text-ink-muted">
          Share your link so friends get credit when they sign up:{" "}
          <code className="rounded bg-surface-muted px-2 py-1 text-ink">
            {typeof window !== "undefined" ? `${window.location.origin}/register?ref=${appUser.referralCode}` : appUser.referralCode}
          </code>
        </p>
        {referrals.length > 0 ? (
          <ul className="space-y-1 text-sm text-ink-muted">
            {referrals.map((r) => (
              <li key={r.id}>
                Referral {r.refereeId.slice(0, 6)}… — {r.status.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-muted">No referrals yet.</p>
        )}
      </section>

      <AddressBook userId={firebaseUser.uid} addresses={appUser.addresses} />
    </div>
  );
}

function AddressBook({ userId, addresses }: { userId: string; addresses: Address[] }) {
  const [list, setList] = useState<Address[]>(addresses);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Address, "id">>({
    label: "Home",
    fullName: "",
    phone: "",
    countryCode: "+234",
    state: "",
    city: "",
    line1: "",
    isDefault: list.length === 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => setList(addresses), [addresses]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await saveAddress(userId, list, { ...form, id: generateAddressId() });
      setList(next);
      setShowForm(false);
      setForm({ ...form, fullName: "", line1: "", city: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">Saved addresses</p>
        <Button size="sm" variant="ghost" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add address"}
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-ink-muted">No saved addresses yet — add one to speed up checkout.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-card border border-surface-muted bg-surface p-3 text-sm">
              <div>
                <p className="font-medium text-ink">
                  {a.label} {a.isDefault ? <span className="text-xs text-accent-dark">(default)</span> : null}
                </p>
                <p className="text-ink-muted">{a.line1}, {a.city}, {a.state}</p>
              </div>
              <button
                onClick={async () => setList(await removeAddress(userId, list, a.id))}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={handleAdd} className="grid gap-2 rounded-card border border-surface-muted bg-surface p-4 sm:grid-cols-2">
          <input required placeholder="Label (e.g. Home)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <input required placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <input required placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <input required placeholder="Street address" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="rounded-card border border-surface-muted px-3 py-2 text-sm sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm text-ink-muted sm:col-span-2">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default address
          </label>
          <Button type="submit" size="sm" loading={saving} className="sm:col-span-2">Save address</Button>
        </form>
      ) : null}
    </section>
  );
}

function DashCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-card border border-surface-muted bg-surface p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="mt-1">{value}</div>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
