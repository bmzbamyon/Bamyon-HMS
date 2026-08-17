"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listAllProductsForAdmin, getProductVariants } from "@/lib/firestore/products";
import { recordPosSale } from "@/lib/firestore/pos";
import { listAllOrdersForAdmin } from "@/lib/firestore/orders";
import type { CartItem, Order, Product, Variant } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { addMinor, formatMoney } from "@/lib/money";
import { logError } from "@/lib/firestore/errorLog";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function AdminPosPage() {
  const { appUser } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ product: Product; variants: Variant[] }[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerUid, setCustomerUid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "wallet">("cash");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<{ orderId: string; orderNo: string; totalMinor: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [todaysPosOrders, setTodaysPosOrders] = useState<Order[]>([]);

  useEffect(() => {
    listAllOrdersForAdmin().then((all) => {
      const today = new Date();
      const isToday = (t: number) => {
        const d = new Date(t);
        return d.toDateString() === today.toDateString();
      };
      setTodaysPosOrders(all.filter((o) => o.channel === "pos" && isToday(o.createdAt)));
    });
  }, [receipt]);

  async function runSearch() {
    setSearching(true);
    const all = await listAllProductsForAdmin();
    const matched = all.filter(
      (p) => p.status === "published" && p.title.toLowerCase().includes(search.toLowerCase())
    );
    const withVariants = await Promise.all(
      matched.slice(0, 10).map(async (p) => ({ product: p, variants: await getProductVariants(p.id) }))
    );
    setResults(withVariants);
    setSearching(false);
  }

  function addToCart(product: Product, variant: Variant) {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id);
      if (existing) {
        return prev.map((i) => (i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          titleSnapshot: `${product.title}${Object.values(variant.attributes).length ? ` (${Object.values(variant.attributes).join("/")})` : ""}`,
          priceMinorSnapshot: variant.priceMinor,
        },
      ];
    });
  }

  const totalMinor = addMinor(...cart.map((i) => i.priceMinorSnapshot * i.quantity));

  async function checkout() {
    if (!appUser) return;
    setError(null);
    setProcessing(true);
    try {
      const result = await recordPosSale({
        staffUid: appUser.uid,
        customerUid: customerUid || undefined,
        items: cart,
        currency: CURRENCY,
        paymentMethod,
      });
      setReceipt(result);
      setCart([]);
      setCustomerUid("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sale failed.");
      logError({ error: err, context: "pos.recordSale", userId: appUser?.uid });
    } finally {
      setProcessing(false);
    }
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-sm space-y-4 rounded-card border border-surface-muted bg-surface p-6 text-center">
        <p className="font-display text-xl font-bold text-ink">Sale complete</p>
        <p className="text-sm text-ink-muted">Receipt {receipt.orderNo}</p>
        <p className="font-display text-2xl font-bold text-brand">{formatMoney(receipt.totalMinor, CURRENCY)}</p>
        <div className="flex justify-center gap-2">
          <a href={`/receipt/${receipt.orderId}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost">Print receipt</Button>
          </a>
          <Button onClick={() => setReceipt(null)}>New sale</Button>
        </div>
      </div>
    );
  }

  const todaysRevenue = addMinor(...todaysPosOrders.map((o) => o.totalMinor));
  const topItemToday = (() => {
    const counts: Record<string, number> = {};
    todaysPosOrders.forEach((o) => o.items.forEach((i) => { counts[i.titleSnapshot] = (counts[i.titleSnapshot] ?? 0) + i.quantity; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "—";
  })();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-surface-muted bg-surface p-4">
          <p className="text-xs text-ink-muted">Today's in-store sales</p>
          <p className="font-display text-xl font-bold text-ink">{todaysPosOrders.length}</p>
        </div>
        <div className="rounded-card border border-surface-muted bg-surface p-4">
          <p className="text-xs text-ink-muted">Today's revenue</p>
          <p className="font-display text-xl font-bold text-ink">{formatMoney(todaysRevenue, CURRENCY)}</p>
        </div>
        <div className="rounded-card border border-surface-muted bg-surface p-4">
          <p className="text-xs text-ink-muted">Top seller today</p>
          <p className="truncate font-display text-lg font-bold text-ink">{topItemToday}</p>
        </div>
      </div>

    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-ink">Point of sale</h1>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search product by name…"
            className="flex-1 rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={runSearch} loading={searching}>Search</Button>
        </div>
        <div className="space-y-2">
          {results.map(({ product, variants }) => (
            <div key={product.id} className="rounded-card border border-surface-muted bg-surface p-3">
              <p className="text-sm font-medium text-ink">{product.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => addToCart(product, v)}
                    disabled={v.stockOnHand <= 0}
                    className="rounded-card border border-surface-muted px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    {Object.values(v.attributes).join("/") || v.sku} · {formatMoney(v.priceMinor, v.currency)} ({v.stockOnHand} in stock)
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-fit space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Current sale</p>
        {cart.length === 0 ? (
          <p className="text-sm text-ink-muted">No items added yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {cart.map((i) => (
              <li key={i.variantId} className="flex justify-between">
                <span>{i.titleSnapshot} × {i.quantity}</span>
                <Price amountMinor={i.priceMinorSnapshot * i.quantity} currency={CURRENCY} size="sm" />
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between border-t border-surface-muted pt-3 font-semibold">
          <span>Total</span>
          <Price amountMinor={totalMinor} currency={CURRENCY} size="md" />
        </div>

        <input
          placeholder="Customer UID (optional — leave blank for walk-in)"
          value={customerUid}
          onChange={(e) => setCustomerUid(e.target.value)}
          className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
        />

        <div className="flex gap-2">
          {(["cash", "bank_transfer", "wallet"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`flex-1 rounded-card border px-2 py-1.5 text-xs font-medium ${
                paymentMethod === m ? "border-brand bg-brand-light text-brand-dark" : "border-surface-muted text-ink-muted"
              }`}
            >
              {m.replace("_", " ")}
            </button>
          ))}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button className="w-full" onClick={checkout} loading={processing} disabled={cart.length === 0}>
          Complete sale
        </Button>
      </div>
    </div>
    </div>
  );
}
