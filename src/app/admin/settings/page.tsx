"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ExchangeRate, Store } from "@/types";
import { Button } from "@/components/ui/Button";

const FEATURE_FLAG_LABELS: { key: keyof Store["featureFlags"]; label: string }[] = [
  { key: "wallet", label: "Wallet & deposits" },
  { key: "affiliate", label: "Affiliate program" },
  { key: "referrals", label: "Referral program" },
  { key: "community", label: "Community (Phase 7)" },
  { key: "courses", label: "Courses (Phase 7)" },
  { key: "pos", label: "Point of sale" },
];

const ratesCol = () => collection(db, "stores", STORE_ID, "exchangeRates");

export default function AdminSettingsPage() {
  const { appUser } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [newCurrency, setNewCurrency] = useState("");
  const [newRate, setNewRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [storeSnap, ratesSnap] = await Promise.all([getDoc(doc(db, "stores", STORE_ID)), getDocs(ratesCol())]);
    if (storeSnap.exists()) setStore(storeSnap.data() as Store);
    setRates(ratesSnap.docs.map((d) => d.data() as ExchangeRate));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleFlag(key: keyof Store["featureFlags"]) {
    if (!store) return;
    const next = { ...store.featureFlags, [key]: !store.featureFlags[key] };
    await setDoc(doc(db, "stores", STORE_ID), { featureFlags: next, updatedAt: Date.now() }, { merge: true });
    setStore({ ...store, featureFlags: next });
  }

  async function addEnabledCurrency() {
    if (!store || !newCurrency) return;
    setSaving(true);
    try {
      const code = newCurrency.toUpperCase().trim();
      const nextCurrencies = Array.from(new Set([...store.enabledCurrencies, code]));
      await setDoc(doc(db, "stores", STORE_ID), { enabledCurrencies: nextCurrencies, updatedAt: Date.now() }, { merge: true });
      if (newRate) {
        await setDoc(doc(ratesCol(), `${store.baseCurrency}_${code}`), {
          fromCurrency: store.baseCurrency,
          toCurrency: code,
          rate: Number(newRate),
          source: "manual",
          setByUid: appUser?.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      setNewCurrency("");
      setNewRate("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading || !store) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Store settings</h1>
        <p className="text-sm text-ink-muted">Currency, exchange rates, and which modules are switched on.</p>
      </div>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Currency</p>
        <p className="text-sm text-ink-muted">
          Base currency: <span className="font-semibold text-ink">{store.baseCurrency}</span>. Orders always store
          the exact currency and rate used at purchase time — changing a rate here never rewrites historical orders.
        </p>
        <div className="flex flex-wrap gap-2">
          {store.enabledCurrencies.map((c) => (
            <span key={c} className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink">{c}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            placeholder="New currency (e.g. USD)"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value)}
            className="w-40 rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            placeholder={`Rate (1 ${store.baseCurrency} = ? )`}
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            className="flex-1 rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={addEnabledCurrency} loading={saving}>Add</Button>
        </div>
        {rates.length > 0 ? (
          <ul className="space-y-1 text-xs text-ink-muted">
            {rates.map((r) => (
              <li key={`${r.fromCurrency}_${r.toCurrency}`}>
                1 {r.fromCurrency} = {r.rate} {r.toCurrency} · {r.source}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-ink-muted">
          Rates set here are manual. Swapping in a live provider (e.g. a daily-refresh exchange-rate
          API) only requires replacing how this list is populated — the rest of the app already reads
          rates by currency pair.
        </p>
      </section>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Modules</p>
        {FEATURE_FLAG_LABELS.map((f) => (
          <label key={f.key} className="flex items-center justify-between text-sm text-ink-muted">
            {f.label}
            <input type="checkbox" checked={store.featureFlags[f.key]} onChange={() => toggleFlag(f.key)} />
          </label>
        ))}
      </section>
    </div>
  );
}
