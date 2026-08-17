"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from "recharts";
import { GlanceCard } from "@/components/admin/GlanceCard";
import { listAllOrdersForAdmin } from "@/lib/firestore/orders";
import { listAllProductsForAdmin } from "@/lib/firestore/products";
import { listPendingBankTransfers } from "@/lib/firestore/payments";
import { listCustomers } from "@/lib/firestore/users";
import { listPendingWithdrawals } from "@/lib/firestore/withdrawals";
import { formatMoney, addMinor } from "@/lib/money";
import type { Order, OrderDeliveryStatus, Product, AppUser } from "@/types";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

const STATUS_COLORS: Record<string, string> = {
  placed: "#D6A419",
  processing: "#0B4033",
  packed: "#0B4033",
  dispatched: "#0B4033",
  in_transit: "#0B4033",
  out_for_delivery: "#0B4033",
  delivered: "#22C55E",
  completed: "#22C55E",
  issue: "#DC2626",
  cancelled: "#9CA3AF",
};

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export default function AdminOverviewPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<AppUser[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<number>(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [o, p, c, transfers, withdrawals] = await Promise.all([
        listAllOrdersForAdmin(),
        listAllProductsForAdmin(),
        listCustomers(),
        listPendingBankTransfers(),
        listPendingWithdrawals(),
      ]);
      setOrders(o);
      setProducts(p);
      setCustomers(c);
      setPendingTransfers(transfers.length);
      setPendingWithdrawals(withdrawals.length);
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const todayOrders = orders.filter((o) => isSameDay(o.createdAt, now));
  const yesterdayOrders = orders.filter((o) => isSameDay(o.createdAt, now - 86400000));
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const revenueToday = addMinor(...todayOrders.filter((o) => o.paymentStatus === "paid").map((o) => o.totalMinor));
  const revenueYesterday = addMinor(...yesterdayOrders.filter((o) => o.paymentStatus === "paid").map((o) => o.totalMinor));
  const revenueChangePct =
    revenueYesterday > 0 ? Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100) : null;

  const totalRevenue = addMinor(...paidOrders.map((o) => o.totalMinor));
  const publishedProducts = products.filter((p) => p.status === "published");
  const lowStockCount = products.length; // refined per-variant check happens on the inventory page; this is a lightweight proxy
  const newCustomersToday = customers.filter((c) => isSameDay(c.createdAt, now)).length;

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.deliveryStatus] = (counts[o.deliveryStatus] ?? 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ name: status.replace(/_/g, " "), value: count, status }));
  }, [orders]);

  const last7DaysRevenue = useMemo(() => {
    const days: { label: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - i * 86400000;
      const label = new Date(dayStart).toLocaleDateString(undefined, { weekday: "short" });
      const revenue = addMinor(
        ...orders.filter((o) => o.paymentStatus === "paid" && isSameDay(o.createdAt, dayStart)).map((o) => o.totalMinor)
      );
      days.push({ label, revenue: revenue / 100 });
    }
    return days;
  }, [orders, now]);

  const recentActivity = useMemo(() => {
    return [...orders]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6)
      .map((o) => ({
        id: o.id,
        label: `${o.orderNo} · ${o.deliveryStatus.replace(/_/g, " ")}`,
        time: new Date(o.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        amount: formatMoney(o.totalMinor, o.currency),
      }));
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Command center</h1>
          <p className="text-sm text-ink-muted">Everything visible — commerce, customers, money, staff — at a glance.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <GlanceCard
              href="/admin/orders"
              icon="₦"
              label="Revenue today"
              value={formatMoney(revenueToday, CURRENCY)}
              trend={
                revenueChangePct !== null
                  ? { value: `${Math.abs(revenueChangePct)}% vs yesterday`, positive: revenueChangePct >= 0 }
                  : undefined
              }
              hint={revenueChangePct === null ? "No data for yesterday yet" : undefined}
            />
            <GlanceCard
              href="/admin/orders"
              icon="📦"
              label="Orders today"
              value={String(todayOrders.length)}
              hint={`${orders.length} all-time`}
            />
            <GlanceCard
              href="/admin/customers"
              icon="👥"
              label="New customers today"
              value={String(newCustomersToday)}
              hint={`${customers.length} total`}
            />
            <GlanceCard
              href="/admin/products"
              icon="🛒"
              label="Published products"
              value={String(publishedProducts.length)}
              hint={products.length === 0 ? "No products yet" : `${products.length} total (incl. drafts)`}
            />
            <GlanceCard
              href="/admin/wallet"
              icon="🏦"
              label="Pending bank transfers"
              value={String(pendingTransfers)}
              hint={pendingTransfers === 0 ? "Nothing awaiting review" : "Needs review"}
            />
            <GlanceCard
              href="/admin/affiliates"
              icon="🔗"
              label="Pending withdrawals"
              value={String(pendingWithdrawals)}
              hint={pendingWithdrawals === 0 ? "Nothing pending" : "Needs review"}
            />
            <GlanceCard
              href="/admin/orders"
              icon="💰"
              label="Total revenue"
              value={formatMoney(totalRevenue, CURRENCY)}
              hint={paidOrders.length === 0 ? "No recorded revenue yet" : `${paidOrders.length} paid orders`}
            />
            <GlanceCard
              href="/admin/attendance"
              icon="🕒"
              label="Staff & operations"
              value="Attendance"
              hint="View clock in/out history"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-card border border-surface-muted bg-surface p-5">
              <p className="mb-3 font-semibold text-ink">Order status</p>
              {orders.length === 0 ? (
                <p className="text-sm text-ink-muted">No orders yet — this chart fills in as orders come through.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-40 w-40 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                          {statusBreakdown.map((entry, i) => (
                            <Cell key={i} fill={STATUS_COLORS[entry.status] ?? "#0B4033"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {statusBreakdown.map((s) => (
                      <li key={s.status} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? "#0B4033" }} />
                        <span className="capitalize text-ink-muted">{s.name}</span>
                        <span className="font-semibold text-ink">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-card border border-surface-muted bg-surface p-5">
              <p className="mb-3 font-semibold text-ink">Revenue — last 7 days</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last7DaysRevenue}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0B4033" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#0B4033" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatMoney(v * 100, CURRENCY)} />
                    <Area type="monotone" dataKey="revenue" stroke="#0B4033" fill="url(#revenueFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-surface-muted bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-ink">Recent activity</p>
              <Link href="/admin/orders" className="text-xs text-brand">View all →</Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-ink-muted">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-surface-muted">
                {recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{a.label}</span>
                    <span className="text-ink-muted">{a.time}</span>
                    <span className="font-semibold text-ink">{a.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
