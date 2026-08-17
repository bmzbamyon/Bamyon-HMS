"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product, Variant } from "@/types";
import { Price } from "@/components/ui/Price";
import { useAuth } from "@/lib/auth/AuthProvider";
import { toggleWishlist } from "@/lib/firestore/wishlist";

export function ProductCard({
  product,
  primaryVariant,
  wishlisted = false,
}: {
  product: Product;
  primaryVariant?: Variant;
  wishlisted?: boolean;
}) {
  const { firebaseUser } = useAuth();
  const image = product.media[0];
  const outOfStock = primaryVariant
    ? primaryVariant.stockOnHand - primaryVariant.stockReserved <= 0
    : false;
  const lowStock =
    primaryVariant && !outOfStock
      ? primaryVariant.stockOnHand - primaryVariant.stockReserved <= primaryVariant.lowStockThreshold
      : false;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-surface-muted bg-surface transition hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.title}
            fill
            sizes="(max-width: 640px) 50vw, 20vw"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-medium uppercase tracking-wide text-ink-muted">
            No image yet
          </div>
        )}
        {outOfStock ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            Out of stock
          </span>
        ) : lowStock ? (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-dark">
            Low stock
          </span>
        ) : null}
        {firebaseUser ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist(firebaseUser.uid, product.id, wishlisted);
            }}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm shadow"
          >
            {wishlisted ? "♥" : "♡"}
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium text-ink">{product.title}</p>
        {product.ratingCount > 0 ? (
          <p className="text-xs text-ink-muted">
            ★ {product.ratingAverage.toFixed(1)} · {product.ratingCount} review
            {product.ratingCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">No reviews yet</p>
        )}
        {primaryVariant ? (
          <Price
            amountMinor={primaryVariant.priceMinor}
            currency={primaryVariant.currency}
            compareAtMinor={primaryVariant.compareAtPriceMinor}
            size="sm"
          />
        ) : null}
      </div>
    </Link>
  );
}
