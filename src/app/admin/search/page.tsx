"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { listCustomers } from "@/lib/firestore/users";
import { listAllOrdersForAdmin } from "@/lib/firestore/orders";
import { listAllProductsForAdmin } from "@/lib/firestore/products";
import type { AppUser, Order, Product } from "@/types";
import { formatMoney } from "@/lib/money";

function AdminSearchContent() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  const [customers, setCustomers] = useState<AppUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listCustomers(), listAllOrdersForAdmin(), listAllProductsForAdmin()]).then(
      ([c, o, p]) => {
        setCustomers(c);
        setOrders(o);
        setProducts(p);
        setLoading(false);
      }
    );
  }, []);

  const matchedCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  );
  const matchedOrders = orders.filter(
    (o) => o.orderNo.toLowerCase().includes(q) || o.deliveryAddress.fullName.toLowerCase().includes(q)
  );
  const matchedProducts = products.filter((p) => p.title.toLowerCase().includes(q));

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-ink">Results for "{q}"</h1>

      {loading ? (
        <p className="text-sm text-ink-muted">Searching…</p>
      ) : (
        <>
          <ResultSection title={`Customers (${matchedCustomers.length})`}>
            {matchedCustomers.map((c) => (
              <Link key={c.uid} href={`/admin/customers/${c.uid}`} className="block rounded-card border border-surface-muted bg-surface p-3 text-sm hover:border-brand">
                <span className="font-medium text-ink">{c.name}</span> — <span className="text-ink-muted">{c.email}</span>
              </Link>
            ))}
          </ResultSection>

          <ResultSection title={`Orders (${matchedOrders.length})`}>
            {matchedOrders.map((o) => (
              <div key={o.id} className="flex justify-between rounded-card border border-surface-muted bg-surface p-3 text-sm">
                <span className="font-medium text-ink">{o.orderNo}</span>
                <span className="text-ink-muted">{formatMoney(o.totalMinor, o.currency)}</span>
              </div>
            ))}
          </ResultSection>

          <ResultSection title={`Products (${matchedProducts.length})`}>
            {matchedProducts.map((p) => (
              <Link key={p.id} href={`/admin/products/${p.id}`} className="block rounded-card border border-surface-muted bg-surface p-3 text-sm hover:border-brand">
                {p.title}
              </Link>
            ))}
          </ResultSection>
        </>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section className="space-y-2">
      <p className="font-semibold text-ink">{title}</p>
      {items.length === 0 ? <p className="text-sm text-ink-muted">No matches.</p> : <div className="space-y-2">{items}</div>}
    </section>
  );
}

export default function AdminSearchPage() {
  return (
    <Suspense fallback={null}>
      <AdminSearchContent />
    </Suspense>
  );
}
