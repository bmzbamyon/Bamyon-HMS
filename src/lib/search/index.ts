import { firestoreSearchAdapter } from "@/lib/search/firestoreAdapter";
import type { SearchOptions } from "@/lib/search/types";

export type { SearchOptions } from "@/lib/search/types";

/**
 * The active search adapter. To move to Algolia/Typesense/Meilisearch/etc,
 * write a new adapter implementing SearchAdapter (see types.ts) and swap
 * the export below — nothing else in the app needs to change.
 */
const activeAdapter = firestoreSearchAdapter;

export function searchProducts(query: string, options?: SearchOptions) {
  return activeAdapter.searchProducts(query, options);
}
