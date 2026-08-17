/**
 * Multi-tenant / white-label scoping.
 *
 * Phase 1-5 ships one storeId per deployment (one Vercel project + one
 * Firebase project per merchant is the simplest, safest white-label model —
 * see build documentation section 33). NEXT_PUBLIC_STORE_ID identifies which
 * store document this deployment serves.
 *
 * IMPORTANT: this constant is a convenience for client queries, not a
 * security boundary by itself. The Firestore Security Rules (firestore.rules)
 * independently check storeId on every read/write — never assume a query
 * filter is sufficient authorization.
 */
export const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? "";

if (!STORE_ID && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.error(
    "NEXT_PUBLIC_STORE_ID is not set. Copy .env.local.example to .env.local and fill it in."
  );
}
