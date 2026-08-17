import type { Product } from "@/types";

export interface SearchOptions {
  take?: number;
  categoryId?: string;
}

/**
 * Every search implementation in this app conforms to this interface.
 * Build documentation section 17 is explicit that Firestore is not a
 * full-text search engine, and that the storefront should be able to swap
 * to a dedicated provider (Algolia, Typesense, Meilisearch,
 * Elasticsearch/OpenSearch) once the catalogue outgrows simple filtering —
 * without rewriting the shop page.
 *
 * To swap providers: implement this interface in a new file (e.g.
 * `lib/search/algoliaAdapter.ts`) and change the export in
 * `lib/search/index.ts` to point at it. No other file needs to change —
 * `shop/page.tsx` only ever imports `searchProducts` from `lib/search`.
 */
export interface SearchAdapter {
  searchProducts(query: string, options?: SearchOptions): Promise<Product[]>;
}
