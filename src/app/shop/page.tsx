"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { getProductVariants } from "@/lib/firestore/products";
import { listCategories } from "@/lib/firestore/categories";
import { searchProducts } from "@/lib/search";
import { subscribeToWishlist } from "@/lib/firestore/wishlist";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Category, Product, Variant } from "@/types";

function ShopContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const { firebaseUser } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, Variant[]>>({});
  const [wishlistedIds, setWishlistedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setWishlistedIds([]);
      return;
    }
    return subscribeToWishlist(firebaseUser.uid, setWishlistedIds);
  }, [firebaseUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Goes through the search abstraction (lib/search) rather than
      // querying Firestore directly — see lib/search/types.ts for why:
      // this is the one seam that lets a real search provider swap in
      // later without touching this page.
      const [productList, categoryList] = await Promise.all([
        searchProducts(q, { take: 60 }),
        listCategories(),
      ]);
      if (cancelled) return;
      setProducts(productList);
      setCategories(categoryList);
      const variantEntries = await Promise.all(
        productList.map(async (p) => [p.id, await getProductVariants(p.id)] as const)
      );
      if (cancelled) return;
      setVariantsByProduct(Object.fromEntries(variantEntries));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          {q ? `Results for "${q}"` : "All products"}
        </h1>
        <p className="text-sm text-ink-muted">{products.length} product{products.length === 1 ? "" : "s"}</p>
      </div>
      <CategoryNav categories={categories} />
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-card bg-surface-muted" />
          ))}
        </div>
      ) : (
        <ProductGrid
          products={products}
          variantsByProduct={variantsByProduct}
          wishlistedIds={wishlistedIds}
          emptyTitle={q ? "No products match your search." : "No products published yet."}
          emptyDescription={q ? "Try a different keyword or browse all products." : undefined}
        />
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}
