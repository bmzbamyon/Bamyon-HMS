import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Address, CartItem, Order, OrderItem, Variant } from "@/types";
import { addMinor } from "@/lib/money";
import { InsufficientStockError, InsufficientWalletBalanceError } from "@/lib/firestore/errors";
import { debitWalletForPosSale } from "@/lib/firestore/wallet";

function generateReceiptNo(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `POS-${stamp}`;
}

const WALK_IN_ADDRESS: Address = {
  id: "pos-walkin",
  label: "In-store",
  fullName: "Walk-in customer",
  phone: "",
  countryCode: "",
  state: "",
  city: "",
  line1: "In-store pickup",
  isDefault: false,
};

/**
 * Records an in-person sale. Unlike placeOrder() (storefront), a POS sale
 * is settled immediately — cash/transfer/wallet has already changed hands
 * in front of the staff member — so this decrements stockOnHand directly
 * in one transaction rather than going through the reserve → pay →
 * fulfill pipeline. The resulting order still lands in the same `orders`
 * collection with `channel: "pos"`, so it feeds the same revenue/analytics
 * queries as any storefront order (build doc section 20: "POS sales appear
 * in the same analytics/order/revenue engine with a channel = POS marker").
 */
export async function recordPosSale(params: {
  staffUid: string;
  customerUid?: string; // an existing registered customer, or omitted for a walk-in
  items: CartItem[];
  currency: string;
  paymentMethod: "cash" | "bank_transfer" | "wallet";
}): Promise<{ orderId: string; orderNo: string; totalMinor: number }> {
  if (params.items.length === 0) throw new Error("Cannot record a sale with no items.");

  const orderRef = doc(db, "stores", STORE_ID, "orders", `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const orderNo = generateReceiptNo();

  const totalMinor = await runTransaction(db, async (tx) => {
    const variantRefs = params.items.map((i) =>
      doc(db, "stores", STORE_ID, "products", i.productId, "variants", i.variantId)
    );
    const variantSnaps = await Promise.all(variantRefs.map((r) => tx.get(r)));

    const orderItems: OrderItem[] = [];
    let subtotalMinor = 0;

    for (let idx = 0; idx < params.items.length; idx++) {
      const cartItem = params.items[idx]!;
      const snap = variantSnaps[idx]!;
      if (!snap.exists()) throw new Error(`${cartItem.titleSnapshot} is no longer available.`);
      const variant = snap.data() as Variant;
      if (variant.stockOnHand < cartItem.quantity) {
        throw new InsufficientStockError(cartItem.titleSnapshot);
      }
      const lineTotal = variant.priceMinor * cartItem.quantity;
      subtotalMinor = addMinor(subtotalMinor, lineTotal);
      orderItems.push({
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        titleSnapshot: cartItem.titleSnapshot,
        attributesSnapshot: variant.attributes,
        quantity: cartItem.quantity,
        unitPriceMinorSnapshot: variant.priceMinor,
        lineTotalMinor: lineTotal,
      });
    }

    variantRefs.forEach((ref, idx) => {
      const variant = variantSnaps[idx]!.data() as Variant;
      tx.update(ref, {
        stockOnHand: variant.stockOnHand - params.items[idx]!.quantity,
        updatedAt: serverTimestamp(),
      });
    });

    const order: Order = {
      id: orderRef.id,
      storeId: STORE_ID,
      orderNo,
      userId: params.customerUid ?? "walkin",
      items: orderItems,
      currency: params.currency,
      subtotalMinor,
      deliveryFeeMinor: 0,
      discountMinor: 0,
      totalMinor: subtotalMinor,
      paymentStatus: "paid",
      paymentMethod: params.paymentMethod,
      deliveryStatus: "completed",
      deliveryAddress: WALK_IN_ADDRESS,
      channel: "pos",
      notes: `POS sale by staff ${params.staffUid} · payment: ${params.paymentMethod}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tx.set(orderRef, { ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return subtotalMinor;
  });

  if (params.paymentMethod === "wallet") {
    if (!params.customerUid) {
      throw new Error("Wallet payment requires selecting a registered customer.");
    }
    try {
      await debitWalletForPosSale({
        userId: params.customerUid,
        amountMinor: totalMinor,
        currency: params.currency,
        reference: `pos:${orderRef.id}`,
        actorId: params.staffUid,
      });
    } catch (err) {
      // Stock was already decremented — this is a genuine edge case (staff
      // selected wallet payment but the customer's balance didn't cover it
      // after all). Surface it clearly so staff can switch payment method
      // and manually reverse the sale via the order/inventory screens.
      throw err instanceof Error ? err : new InsufficientWalletBalanceError();
    }
  }

  return { orderId: orderRef.id, orderNo, totalMinor };
}
