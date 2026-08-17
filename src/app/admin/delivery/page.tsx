"use client";

import { useEffect, useState } from "react";
import { listDeliveryZones, createDeliveryZone, deleteDeliveryZone } from "@/lib/firestore/delivery";
import type { DeliveryZone } from "@/types";
import { formatMoney, toMinorUnits } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function AdminDeliveryPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [states, setStates] = useState("");
  const [fee, setFee] = useState("");
  const [minDays, setMinDays] = useState("3");
  const [maxDays, setMaxDays] = useState("6");
  const [isDefault, setIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setZones(await listDeliveryZones());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createDeliveryZone({
        name,
        states: states.split(",").map((s) => s.trim()).filter(Boolean),
        feeMinor: toMinorUnits(Number(fee), CURRENCY),
        estimateDaysMin: Number(minDays),
        estimateDaysMax: Number(maxDays),
        isDefault,
      });
      setName("");
      setStates("");
      setFee("");
      setIsDefault(false);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Delivery zones</h1>
        <p className="text-sm text-ink-muted">
          Checkout looks up the customer's state against these zones to calculate the real delivery
          fee. Mark one zone "default" to cover any state not explicitly listed.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : zones.length === 0 ? (
        <EmptyState
          title="No delivery zones configured yet."
          description="Until you add one, checkout uses a flat placeholder fee — add a zone below to take control of it."
        />
      ) : (
        <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
          {zones.map((z) => (
            <li key={z.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <p className="font-medium text-ink">
                  {z.name} {z.isDefault ? <span className="text-accent-dark">(default)</span> : null}
                </p>
                <p className="text-xs text-ink-muted">
                  {z.states.length > 0 ? z.states.join(", ") : "Matches any unlisted state"} · {z.estimateDaysMin}-{z.estimateDaysMax} days
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-ink">{formatMoney(z.feeMinor, CURRENCY)}</span>
                <button
                  onClick={async () => {
                    await deleteDeliveryZone(z.id);
                    refresh();
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="grid gap-2 rounded-card border border-surface-muted bg-surface p-5 sm:grid-cols-2">
        <input required placeholder="Zone name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <input placeholder="States, comma separated (blank = default)" value={states} onChange={(e) => setStates(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <input required type="number" placeholder={`Fee (${CURRENCY})`} value={fee} onChange={(e) => setFee(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input type="number" placeholder="Min days" value={minDays} onChange={(e) => setMinDays(e.target.value)} className="w-1/2 rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <input type="number" placeholder="Max days" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} className="w-1/2 rounded-card border border-surface-muted px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted sm:col-span-2">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Use as the default zone for states not listed above
        </label>
        <Button type="submit" loading={creating} size="sm" className="sm:col-span-2">Add zone</Button>
      </form>
    </div>
  );
}
