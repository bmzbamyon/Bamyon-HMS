"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { getCategoryBySlug } from "@/lib/firestore/categories";
import { listPublishedProducts, getProductVariants } from "@/lib/firestore/products";
import type { Category, Product, Variant } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, Variant[]>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cat = await getCategoryBySlug(params.slug);
      if (cancelled) return;
      if (!cat) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCategory(cat);
      const productList = await listPublishedProducts({ categoryId: cat.id, take: 60 });
      if (cancelled) return;
      setProducts(productList);
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
  }, [params.slug]);

  if (notFound) {
    return <EmptyState title="Category not found." description="It may have been renamed or removed." />;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">{category?.name ?? "Category"}</h1>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-card bg-surface-muted" />
          ))}
        </div>
      ) : (
        <ProductGrid
          products={products}
          variantsByProduct={variantsByProduct}
          emptyDescription="No products have been published in this category yet."
        />
      )}
    </div>
  );
}
