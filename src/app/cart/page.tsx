"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  readLocalCart,
  removeLocalItem,
  setLocalItemQuantity,
} from "@/lib/firestore/cart";
import type { CartItem } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { addMinor } from "@/lib/money";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readLocalCart());
  }, []);

  const subtotalMinor = addMinor(...items.map((i) => i.priceMinorSnapshot * i.quantity));

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty."
        description="Products you add will show up here."
        action={
          <Link href="/shop">
            <Button size="sm">Browse products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-ink">Your cart</h1>
        <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
          {items.map((item) => (
            <li key={item.variantId} className="flex items-center gap-4 p-4">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-card bg-surface-muted">
                {item.imageSnapshot ? (
                  <Image src={item.imageSnapshot} alt={item.titleSnapshot} fill sizes="64px" className="object-cover" />
                ) : null}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{item.titleSnapshot}</p>
                <Price amountMinor={item.priceMinorSnapshot} currency={CURRENCY} size="sm" />
              </div>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => setItems(setLocalItemQuantity(item.variantId, Number(e.target.value)))}
                className="w-16 rounded-card border border-surface-muted px-2 py-1 text-center text-sm"
                aria-label={`Quantity for ${item.titleSnapshot}`}
              />
              <button
                onClick={() => setItems(removeLocalItem(item.variantId))}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="h-fit space-y-4 rounded-card border border-surface-muted bg-surface p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">Subtotal</span>
          <Price amountMinor={subtotalMinor} currency={CURRENCY} size="md" />
        </div>
        <p className="text-xs text-ink-muted">Delivery fee is calculated at checkout based on your address.</p>
        <Link href="/checkout">
          <Button className="w-full">Proceed to checkout</Button>
        </Link>
      </div>
    </div>
  );
}
