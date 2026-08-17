import type { Product, Variant } from "@/types";
import { ProductCard } from "@/components/storefront/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";

export function ProductGrid({
  products,
  variantsByProduct,
  wishlistedIds = [],
  emptyTitle = "No products published yet.",
  emptyDescription,
}: {
  products: Product[];
  variantsByProduct: Record<string, Variant[]>;
  wishlistedIds?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          primaryVariant={variantsByProduct[product.id]?.[0]}
          wishlisted={wishlistedIds.includes(product.id)}
        />
      ))}
    </div>
  );
}
