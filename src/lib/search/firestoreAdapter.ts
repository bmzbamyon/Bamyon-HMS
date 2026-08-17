import type { SearchAdapter, SearchOptions } from "@/lib/search/types";
import { listPublishedProducts } from "@/lib/firestore/products";
import type { Product } from "@/types";

/**
 * Default adapter. Fetches a page of published products from Firestore
 * (optionally scoped to a category) and filters client-side by substring
 * match on title/brand/description. This is genuinely fine for a
 * catalogue of dozens to a few hundred products — it's what the previous
 * inline implementation on the shop page did, just extracted behind the
 * SearchAdapter interface so a real provider can replace it later without
 * touching any UI code.
 *
 * What this adapter does NOT do, and a dedicated provider would: typo
 * tolerance, synonyms, relevance ranking, search analytics (zero-result
 * queries, click-through), or searching fields Firestore can't filter on
 * cheaply. See build documentation section 17.
 */
export const firestoreSearchAdapter: SearchAdapter = {
  async searchProducts(rawQuery: string, options?: SearchOptions): Promise<Product[]> {
    const query = rawQuery.toLowerCase().trim();
    const products = await listPublishedProducts({
      categoryId: options?.categoryId,
      take: options?.take ?? 60,
    });
    if (!query) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  },
};
