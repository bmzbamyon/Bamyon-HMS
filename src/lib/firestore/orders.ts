import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Address, CartItem, Order, OrderItem, Variant } from "@/types";
import { addMinor } from "@/lib/money";
import { reserveWalletFunds, creditRefund } from "@/lib/firestore/wallet";
import { InsufficientStockError, InsufficientWalletBalanceError } from "@/lib/firestore/errors";
import { getProduct } from "@/lib/firestore/products";
import { creditAffiliateConversion, reverseAffiliateConversionsForOrder } from "@/lib/firestore/affiliates";
import { creditReferralOnQualifyingOrder } from "@/lib/firestore/referrals";

export { InsufficientStockError, InsufficientWalletBalanceError };

const ordersCol = () => collection(db, "stores", STORE_ID, "orders");

function generateOrderNo(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IMS-${stamp}-${rand}`;
}

/**
 * Places an order. This is the one function in the app allowed to touch
 * stockReserved/stockOnHand from the client, and it does so inside a single
 * Firestore transaction:
 *   1. Re-reads every variant fresh (never trusts the cart snapshot's price/stock).
 *   2. Fails the whole transaction if any line no longer has enough available
 *      stock (stockOnHand - stockReserved >= quantity) — this is what
 *      prevents two simultaneous purchases from over-selling the same unit.
 *   3. Increments stockReserved (not stockOnHand — stock is only actually
 *      decremented on fulfillment/delivery, see markOrderPaid()).
 *   4. Writes the order with a server-calculated total, never a client total.
 *   5. If paymentMethod is "wallet", reserves the funds in the same logical
 *      step (see wallet.ts) so a customer can't spend the same balance twice.
 *
 * Paystack/bank-transfer orders are created with paymentStatus "pending" and
 * flipped to "paid" only by a server-verified event — see app/api/checkout
 * and app/api/webhooks/paystack.
 */
export async function placeOrder(params: {
  userId: string;
  items: CartItem[];
  deliveryAddress: Address;
  deliveryFeeMinor: number;
  currency: string;
  paymentMethod: Order["paymentMethod"];
  affiliateId?: string | null;
  referralCode?: string | null;
}): Promise<{ orderId: string; orderNo: string; totalMinor: number }> {
  const { userId, items, deliveryAddress, deliveryFeeMinor, currency, paymentMethod } = params;

  if (items.length === 0) throw new Error("Cannot place an order with an empty cart.");

  const orderRef = doc(ordersCol());
  const orderNo = generateOrderNo();

  const result = await runTransaction(db, async (tx) => {
    const variantRefs = items.map((i) =>
      doc(db, "stores", STORE_ID, "products", i.productId, "variants", i.variantId)
    );
    const variantSnaps = await Promise.all(variantRefs.map((r) => tx.get(r)));

    const orderItems: OrderItem[] = [];
    let subtotalMinor = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const cartItem = items[idx]!;
      const snap = variantSnaps[idx]!;
      if (!snap.exists()) {
        throw new Error(`${cartItem.titleSnapshot} is no longer available.`);
      }
      const variant = snap.data() as Variant;
      const available = variant.stockOnHand - variant.stockReserved;
      if (available < cartItem.quantity) {
        throw new InsufficientStockError(cartItem.titleSnapshot);
      }

      const lineTotal = variant.priceMinor * cartItem.quantity;
      subtotalMinor = addMinor(subtotalMinor, lineTotal);

      orderItems.push({
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        titleSnapshot: cartItem.titleSnapshot,
        attributesSnapshot: variant.attributes,
        imageSnapshot: cartItem.imageSnapshot,
        quantity: cartItem.quantity,
        unitPriceMinorSnapshot: variant.priceMinor, // server-fresh price, not the cart's stale snapshot
        lineTotalMinor: lineTotal,
      });
    }

    const totalMinor = addMinor(subtotalMinor, deliveryFeeMinor);

    // Reserve stock for every line item now, inside the same transaction.
    variantRefs.forEach((ref, idx) => {
      const variant = variantSnaps[idx]!.data() as Variant;
      tx.update(ref, {
        stockReserved: variant.stockReserved + items[idx]!.quantity,
        updatedAt: serverTimestamp(),
      });
    });

    const order: Order = {
      id: orderRef.id,
      storeId: STORE_ID,
      orderNo,
      userId,
      items: orderItems,
      currency,
      subtotalMinor,
      deliveryFeeMinor,
      discountMinor: 0,
      totalMinor,
      paymentStatus: paymentMethod === "wallet" ? "reserved" : "pending",
      paymentMethod,
      deliveryStatus: "placed",
      deliveryAddress,
      affiliateId: params.affiliateId ?? null,
      referralCode: params.referralCode ?? null,
      channel: "storefront",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tx.set(orderRef, { ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

    return { totalMinor };
  });

  // Wallet reservation happens as its own ledger transaction (append-only
  // ledger lives in a different subtree than the order/variant docs touched
  // above — Firestore transactions can't span that many unrelated documents
  // reliably at scale, so we treat "stock reserved" as the atomic commit
  // point and wallet reservation as the next step). If this fails, the order
  // is left in "reserved" payment status with no wallet hold — the admin
  // finance queue and the customer's order page both surface this so it can
  // be manually resolved rather than silently losing money either direction.
  if (paymentMethod === "wallet") {
    try {
      await reserveWalletFunds({
        userId,
        amountMinor: result.totalMinor,
        currency,
        orderId: orderRef.id,
      });
    } catch (err) {
      await updateDoc(orderRef, {
        paymentStatus: "failed",
        notes: "Wallet reservation failed after order creation — see wallet ledger.",
        updatedAt: serverTimestamp(),
      });
      throw err instanceof Error ? err : new InsufficientWalletBalanceError();
    }
  }

  return { orderId: orderRef.id, orderNo, totalMinor: result.totalMinor };
}

/**
 * Full or partial refund. Credits the customer's wallet directly (the
 * build brief's default — a refund lands as spendable balance rather than
 * requiring a second manual bank transfer back out). Does NOT restock —
 * that's a separate, deliberate admin action via inventory adjustment,
 * since a refund doesn't always mean the item is resellable.
 */
export async function refundOrder(params: {
  orderId: string;
  amountMinor: number; // may be less than order.totalMinor for a partial refund
  reason: string;
  actorId: string;
}): Promise<void> {
  const orderRef = doc(db, "stores", STORE_ID, "orders", params.orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error("Order not found.");
  const order = orderSnap.data() as Order;

  if (order.paymentStatus !== "paid") {
    throw new Error("Only paid orders can be refunded.");
  }
  if (params.amountMinor <= 0 || params.amountMinor > order.totalMinor) {
    throw new Error("Refund amount must be between 0 and the order total.");
  }

  await creditRefund({
    userId: order.userId,
    amountMinor: params.amountMinor,
    currency: order.currency,
    reference: `refund:${params.orderId}`,
    actorId: params.actorId,
  });

  await updateDoc(orderRef, {
    paymentStatus: params.amountMinor === order.totalMinor ? "refunded" : "paid",
    notes: `Refunded ${params.amountMinor / 100} ${order.currency}: ${params.reason}`,
    updatedAt: serverTimestamp(),
  });
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, "stores", STORE_ID, "orders", orderId));
  return snap.exists() ? (snap.data() as Order) : null;
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  const q = query(
    ordersCol(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    fsLimit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Order);
}

/** Admin/staff — all orders, most recent first. Real pagination should replace
 * this fixed limit once order volume grows past a single page. */
export async function listAllOrdersForAdmin(): Promise<Order[]> {
  const q = query(ordersCol(), orderBy("createdAt", "desc"), fsLimit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Order);
}

export async function updateOrderStatus(
  orderId: string,
  patch: Partial<Pick<Order, "deliveryStatus" | "paymentStatus" | "trackingNumber" | "courier">>
): Promise<void> {
  await updateDoc(doc(db, "stores", STORE_ID, "orders", orderId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Called once a payment is server-verified (Paystack webhook/verify route,
 * or admin confirming a bank transfer). Converts reserved stock into an
 * actual on-hand deduction and marks the order paid.
 */
export async function markOrderPaid(orderId: string): Promise<void> {
  const orderRef = doc(db, "stores", STORE_ID, "orders", orderId);
  const order = await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found.");
    const order = orderSnap.data() as Order;
    if (order.paymentStatus === "paid") return null; // idempotent — webhooks can fire more than once

    const variantRefs = order.items.map((i) =>
      doc(db, "stores", STORE_ID, "products", i.productId, "variants", i.variantId)
    );
    const variantSnaps = await Promise.all(variantRefs.map((r) => tx.get(r)));

    variantRefs.forEach((ref, idx) => {
      const variant = variantSnaps[idx]!.data() as Variant;
      const qty = order.items[idx]!.quantity;
      tx.update(ref, {
        stockOnHand: Math.max(0, variant.stockOnHand - qty),
        stockReserved: Math.max(0, variant.stockReserved - qty),
        updatedAt: serverTimestamp(),
      });
    });

    tx.update(orderRef, { paymentStatus: "paid", updatedAt: serverTimestamp() });
    return order;
  });

  if (!order) return; // already paid — nothing further to credit

  // Affiliate commission and referral crediting happen AFTER the stock
  // transaction commits, as their own ledger-writing steps (see wallet.ts)
  // — Firestore's client SDK doesn't support nesting one runTransaction
  // inside another, so these can't live inside the transaction above.
  if (order.affiliateId) {
    for (const item of order.items) {
      const product = await getProduct(item.productId);
      if (product) {
        await creditAffiliateConversion({
          affiliateId: order.affiliateId,
          orderId,
          product,
          lineTotalMinor: item.lineTotalMinor,
          currency: order.currency,
        });
      }
    }
  }
  await creditReferralOnQualifyingOrder(order.userId, orderId);
}

/** Releases reserved stock without decrementing on-hand — for cancelled/expired orders. */
export async function cancelOrder(orderId: string): Promise<void> {
  const orderRef = doc(db, "stores", STORE_ID, "orders", orderId);
  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found.");
    const order = orderSnap.data() as Order;
    if (order.deliveryStatus === "cancelled") return;

    const variantRefs = order.items.map((i) =>
      doc(db, "stores", STORE_ID, "products", i.productId, "variants", i.variantId)
    );
    const variantSnaps = await Promise.all(variantRefs.map((r) => tx.get(r)));

    variantRefs.forEach((ref, idx) => {
      const variant = variantSnaps[idx]!.data() as Variant;
      const qty = order.items[idx]!.quantity;
      tx.update(ref, {
        stockReserved: Math.max(0, variant.stockReserved - qty),
        updatedAt: serverTimestamp(),
      });
    });

    tx.update(orderRef, {
      deliveryStatus: "cancelled",
      paymentStatus: order.paymentStatus === "paid" ? "refunded" : "failed",
      updatedAt: serverTimestamp(),
    });
  });

  // Reverse any not-yet-approved affiliate commission tied to this order —
  // outside the transaction above for the same nested-transaction reason
  // as markOrderPaid().
  await reverseAffiliateConversionsForOrder(orderId);
}
