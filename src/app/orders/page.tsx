"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listOrdersForUser, cancelOrder } from "@/lib/firestore/orders";
import type { Order, OrderDeliveryStatus } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const STAGE_LABEL: Record<OrderDeliveryStatus, string> = {
  placed: "Order received",
  processing: "Merchant is preparing",
  packed: "Package prepared",
  dispatched: "Courier has package",
  in_transit: "Moving toward destination",
  out_for_delivery: "Final-mile stage",
  delivered: "Delivered",
  completed: "Completed",
  issue: "Issue — contact support",
  cancelled: "Cancelled/",
};

function OrdersPageContent() {
  const { firebaseUser } = useAuth();
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get("placed");
  const bankTransfer = searchParams.get("bankTransfer");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAccountCreds, setNewAccountCreds] = useState<{ email: string; password: string } | null>(null);
  const [credsCopied, setCredsCopied] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem("bamyon:newAccountCreds");
    if (raw) {
      setNewAccountCreds(JSON.parse(raw));
      window.localStorage.removeItem("bamyon:newAccountCreds");
    }
  }, []);

  async function refresh(uid: string) {
    setOrders(await listOrdersForUser(uid));
    setLoading(false);
  }

  useEffect(() => {
    if (firebaseUser) refresh(firebaseUser.uid);
  }, [firebaseUser]);

  if (!firebaseUser) {
    return (
      <div className="text-center">
        <a href="/login?next=/orders" className="font-medium text-brand">Sign in to view your orders</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">Your orders</h1>

      {newAccountCreds ? (
        <div className="space-y-2 rounded-card border-2 border-accent bg-accent/10 p-4">
          <p className="font-semibold text-ink">Your account was created — save your login</p>
          <p className="text-sm text-ink-muted">
            You checked out as a guest, so we made you an account to track this order. Save these
            details now — you can also change the password anytime from your account page.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <code className="rounded bg-surface px-2 py-1">{newAccountCreds.email}</code>
            <code className="rounded bg-surface px-2 py-1">{newAccountCreds.password}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(`${newAccountCreds.email} / ${newAccountCreds.password}`);
                setCredsCopied(true);
                setTimeout(() => setCredsCopied(false), 1500);
              }}
            >
              {credsCopied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      {justPlaced ? (
        <p className="rounded-card bg-brand-light p-3 text-sm text-brand-dark">
          Order placed successfully.{" "}
          {bankTransfer
            ? "Complete your bank transfer and mark it as paid below so our team can confirm it."
            : ""}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet."
          description="Orders you place will show up here with live tracking."
          action={
            <a href="/shop">
              <Button size="sm">Start shopping</Button>
            </a>
          }
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-card border border-surface-muted bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{order.orderNo}</p>
                  <p className="text-xs text-ink-muted">
                    {order.items.length} item{order.items.length === 1 ? "" : "s"} · {order.paymentMethod.replace("_", " ")}
                  </p>
                </div>
                <Price amountMinor={order.totalMinor} currency={order.currency} size="sm" />
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="rounded-full bg-brand-light px-3 py-1 font-medium text-brand-dark">
                  {STAGE_LABEL[order.deliveryStatus]}
                </span>
                <span className="text-ink-muted">
                  Payment: {order.paymentStatus}
                </span>
              </div>

              {order.trackingNumber ? (
                <p className="mt-2 text-sm text-ink-muted">
                  Tracking: {order.trackingNumber} {order.courier ? `via ${order.courier}` : ""}
                </p>
              ) : null}

              {order.paymentStatus === "pending" && order.paymentMethod === "bank_transfer" ? (
                <p className="mt-3 text-sm text-accent-dark">
                  Awaiting your bank transfer confirmation — see the payment instructions sent to your account.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/receipt/${order.id}`}>
                  <Button variant="ghost" size="sm">View receipt</Button>
                </a>
                {order.deliveryStatus === "placed" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await cancelOrder(order.id);
                      refresh(firebaseUser.uid);
                    }}
                  >
                    Cancel order
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  );
}
