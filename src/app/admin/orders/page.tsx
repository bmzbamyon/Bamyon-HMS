"use client";

import { useEffect, useState } from "react";
import { listAllOrdersForAdmin, updateOrderStatus, markOrderPaid, refundOrder } from "@/lib/firestore/orders";
import { useAuth } from "@/lib/auth/AuthProvider";
import { writeAuditLog } from "@/lib/firestore/audit";
import type { Order, OrderDeliveryStatus } from "@/types";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const STAGES: OrderDeliveryStatus[] = [
  "placed",
  "processing",
  "packed",
  "dispatched",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "completed",
  "issue",
  "cancelled",
];

export default function AdminOrdersPage() {
  const { appUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setOrders(await listAllOrdersForAdmin());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">Order operations</h1>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet." description="Orders placed on the storefront will appear here." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-card border border-surface-muted bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{order.orderNo}</p>
                  <p className="text-xs text-ink-muted">{order.deliveryAddress.fullName} · {order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
                </div>
                <p className="font-semibold text-ink">{formatMoney(order.totalMinor, order.currency)}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  value={order.deliveryStatus}
                  onChange={async (e) => {
                    await updateOrderStatus(order.id, { deliveryStatus: e.target.value as OrderDeliveryStatus });
                    refresh();
                  }}
                  className="rounded-card border border-surface-muted px-3 py-1.5 text-sm"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>

                <span className="text-xs text-ink-muted">Payment: {order.paymentStatus}</span>

                <a href={`/receipt/${order.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                  View receipt
                </a>

                {order.paymentStatus !== "paid" && order.paymentMethod === "bank_transfer" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await markOrderPaid(order.id);
                      refresh();
                    }}
                  >
                    Confirm bank transfer received
                  </Button>
                ) : null}

                {order.paymentStatus === "paid" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      const amountStr = prompt(
                        `Refund amount (max ${(order.totalMinor / 100).toLocaleString()} ${order.currency})`,
                        String(order.totalMinor / 100)
                      );
                      if (!amountStr) return;
                      const reason = prompt("Reason for refund (required)") ?? "";
                      if (!reason.trim()) {
                        alert("A refund reason is required.");
                        return;
                      }
                      await refundOrder({
                        orderId: order.id,
                        amountMinor: Math.round(Number(amountStr) * 100),
                        reason,
                        actorId: appUser?.uid ?? "admin",
                      });
                      await writeAuditLog({
                        actorId: appUser?.uid ?? "admin",
                        action: "order.refund",
                        targetType: "order",
                        targetId: order.id,
                        after: { amountMinor: Math.round(Number(amountStr) * 100), reason },
                      });
                      refresh();
                    }}
                  >
                    Refund
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
