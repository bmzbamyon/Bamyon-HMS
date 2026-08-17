"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { subscribeToWishlist } from "@/lib/firestore/wishlist";
import { getProduct, getProductVariants } from "@/lib/firestore/products";
import type { Product, Variant } from "@/types";
import { ProductGrid } from "@/components/storefront/ProductGrid";

export default function WishlistPage() {
  const { firebaseUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, Variant[]>>({});
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    return subscribeToWishlist(firebaseUser.uid, setIds);
  }, [firebaseUser]);

  useEffect(() => {
    (async () => {
      const found = (await Promise.all(ids.map((id) => getProduct(id)))).filter(
        (p): p is Product => !!p
      );
      setProducts(found);
      const variantEntries = await Promise.all(
        found.map(async (p) => [p.id, await getProductVariants(p.id)] as const)
      );
      setVariantsByProduct(Object.fromEntries(variantEntries));
      setLoading(false);
    })();
  }, [ids]);

  if (!firebaseUser) {
    return (
      <div className="text-center">
        <a href="/login?next=/wishlist" className="font-medium text-brand">Sign in to view your wishlist</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">Your wishlist</h1>
      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <ProductGrid
          products={products}
          variantsByProduct={variantsByProduct}
          wishlistedIds={ids}
          emptyTitle="Your wishlist is empty."
          emptyDescription="Tap the heart on any product to save it here."
        />
      )}
    </div>
  );
}
