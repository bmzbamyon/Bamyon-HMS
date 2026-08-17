import Image from "next/image";
import type { Order, Store } from "@/types";
import { formatMoney } from "@/lib/money";

export function ReceiptDocument({ order, store }: { order: Order; store: Store | null }) {
  const issuedAt = new Date(order.createdAt);

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-ink print:max-w-none print:p-0 print:shadow-none">
      <div className="flex items-start justify-between border-b border-surface-muted pb-6">
        <div className="flex items-center gap-3">
          {store?.branding?.logoUrl ? (
            <Image src={store.branding.logoUrl} alt={store.name} width={48} height={48} className="rounded object-contain" />
          ) : null}
          <div>
            <p className="font-display text-xl font-bold text-brand">{store?.name ?? "Bamyon-IMS"}</p>
            <p className="text-xs text-ink-muted">Official receipt</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-ink">{order.orderNo}</p>
          <p className="text-ink-muted">
            {issuedAt.toLocaleDateString()} · {issuedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1 inline-block rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand-dark">
            {order.channel === "pos" ? "In-store sale" : "Online order"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-surface-muted py-6 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Billed to</p>
          <p className="mt-1 font-medium text-ink">{order.deliveryAddress.fullName}</p>
          {order.deliveryAddress.phone ? <p className="text-ink-muted">{order.deliveryAddress.phone}</p> : null}
          {order.deliveryAddress.line1 !== "In-store pickup" ? (
            <p className="text-ink-muted">
              {order.deliveryAddress.line1}, {order.deliveryAddress.city}, {order.deliveryAddress.state}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Payment</p>
          <p className="mt-1 font-medium capitalize text-ink">{order.paymentMethod.replace("_", " ")}</p>
          <p className="text-ink-muted capitalize">{order.paymentStatus}</p>
        </div>
      </div>

      <table className="w-full py-6 text-sm">
        <thead>
          <tr className="border-b border-surface-muted text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="py-2">Item</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Unit price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} className="border-b border-surface-muted/60">
              <td className="py-2">
                <p className="font-medium text-ink">{item.titleSnapshot}</p>
                {Object.keys(item.attributesSnapshot ?? {}).length > 0 ? (
                  <p className="text-xs text-ink-muted">{Object.values(item.attributesSnapshot).join(" / ")}</p>
                ) : null}
              </td>
              <td className="py-2 text-center">{item.quantity}</td>
              <td className="py-2 text-right">{formatMoney(item.unitPriceMinorSnapshot, order.currency)}</td>
              <td className="py-2 text-right font-medium">{formatMoney(item.lineTotalMinor, order.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-56 space-y-1 text-sm">
        <div className="flex justify-between text-ink-muted">
          <span>Subtotal</span>
          <span>{formatMoney(order.subtotalMinor, order.currency)}</span>
        </div>
        {order.deliveryFeeMinor > 0 ? (
          <div className="flex justify-between text-ink-muted">
            <span>Delivery</span>
            <span>{formatMoney(order.deliveryFeeMinor, order.currency)}</span>
          </div>
        ) : null}
        {order.discountMinor > 0 ? (
          <div className="flex justify-between text-ink-muted">
            <span>Discount</span>
            <span>-{formatMoney(order.discountMinor, order.currency)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-surface-muted pt-1 text-base font-bold text-ink">
          <span>Total</span>
          <span>{formatMoney(order.totalMinor, order.currency)}</span>
        </div>
      </div>

      <div className="mt-10 border-t border-surface-muted pt-6 text-center text-xs text-ink-muted">
        <p>Thank you for shopping with {store?.name ?? "us"}.</p>
        <p className="mt-1">Questions about this order? Contact support and reference {order.orderNo}.</p>
      </div>
    </div>
  );
}
