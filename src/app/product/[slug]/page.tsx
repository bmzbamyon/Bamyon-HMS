"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getProductBySlug, getProductVariants, listPublishedProducts } from "@/lib/firestore/products";
import { listReviewsForProduct, submitReview } from "@/lib/firestore/reviews";
import { listOrdersForUser } from "@/lib/firestore/orders";
import { addLocalItem } from "@/lib/firestore/cart";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAffiliateByCode, recordAffiliateClick } from "@/lib/firestore/affiliates";
import { setActiveAffiliateId } from "@/lib/firestore/attribution";
import type { Product, Review, Variant } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCard } from "@/components/storefront/ProductCard";

export default function ProductPage() {
  return (
    <Suspense fallback={null}>
      <ProductPageContent />
    </Suspense>
  );
}

function ProductPageContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const { appUser, firebaseUser } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [added, setAdded] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await getProductBySlug(params.slug);
      if (cancelled) return;
      if (!p || p.status !== "published") {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProduct(p);
      const [variantList, reviewList, allProducts] = await Promise.all([
        getProductVariants(p.id),
        listReviewsForProduct(p.id),
        listPublishedProducts({ take: 10 }),
      ]);
      if (cancelled) return;
      setVariants(variantList);
      setSelectedVariantId(variantList[0]?.id ?? null);
      setReviews(reviewList);
      setRelated(allProducts.filter((rp) => rp.id !== p.id).slice(0, 5));
      setLoading(false);

      if (refCode) {
        const affiliate = await getAffiliateByCode(refCode);
        if (affiliate && affiliate.status === "active") {
          setActiveAffiliateId(affiliate.id);
          recordAffiliateClick(affiliate.id, p.id).catch(() => {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.slug, refCode]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId]
  );

  if (loading) return <ProductSkeleton />;
  if (notFound || !product) {
    return <EmptyState title="Product not found." description="It may be unpublished or removed." />;
  }

  const outOfStock = selectedVariant
    ? selectedVariant.stockOnHand - selectedVariant.stockReserved <= 0
    : true;

  function handleAddToCart() {
    if (!selectedVariant || !product) return;
    addLocalItem({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity: 1,
      titleSnapshot: product.title,
      priceMinorSnapshot: selectedVariant.priceMinor,
      imageSnapshot: product.media[0]?.url,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !appUser || !product) return;
    setReviewError(null);
    setSubmittingReview(true);
    try {
      const myOrders = await listOrdersForUser(firebaseUser.uid);
      await submitReview({
        userId: firebaseUser.uid,
        userName: appUser.name,
        userPhoto: appUser.photoUrl,
        productId: product.id,
        rating: reviewRating,
        body: reviewBody,
        purchaseOrders: myOrders,
      });
      const refreshed = await listReviewsForProduct(product.id);
      setReviews(refreshed);
      setReviewBody("");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not submit review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="space-y-14">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-card bg-surface-muted">
            {product.media[0] ? (
              <Image
                src={product.media[0].url}
                alt={product.media[0].alt ?? product.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                No image uploaded yet
              </div>
            )}
          </div>
          {product.media.length > 1 ? (
            <div className="flex gap-2">
              {product.media.slice(1, 6).map((m) => (
                <div key={m.publicId} className="relative h-16 w-16 overflow-hidden rounded-card bg-surface-muted">
                  <Image src={m.url} alt={m.alt ?? ""} fill sizes="64px" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">{product.title}</h1>
            {product.ratingCount > 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                ★ {product.ratingAverage.toFixed(1)} · {product.ratingCount} verified rating
                {product.ratingCount === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">No reviews yet</p>
            )}
          </div>

          {selectedVariant ? (
            <Price
              amountMinor={selectedVariant.priceMinor}
              currency={selectedVariant.currency}
              compareAtMinor={selectedVariant.compareAtPriceMinor}
              size="lg"
            />
          ) : (
            <p className="text-sm text-ink-muted">Pricing unavailable — no variant configured yet.</p>
          )}

          <p className="whitespace-pre-line text-sm text-ink-muted">{product.description}</p>

          {variants.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`rounded-card border px-4 py-2 text-sm font-medium ${
                    v.id === selectedVariantId
                      ? "border-brand bg-brand-light text-brand-dark"
                      : "border-surface-muted text-ink hover:border-brand"
                  }`}
                >
                  {Object.values(v.attributes).join(" / ") || v.sku}
                </button>
              ))}
            </div>
          ) : null}

          <Button onClick={handleAddToCart} disabled={outOfStock || !selectedVariant} size="lg">
            {outOfStock ? "Out of stock" : added ? "Added to cart ✓" : "Add to cart"}
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-ink">Reviews</h2>
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet." description="Be the first to review this product." />
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-card border border-surface-muted bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{r.userNameSnapshot}</p>
                  <p className="text-sm text-accent-dark">{"★".repeat(r.rating)}</p>
                </div>
                {r.verifiedPurchase ? (
                  <p className="text-xs font-medium text-brand">Verified purchase</p>
                ) : null}
                <p className="mt-2 text-sm text-ink-muted">{r.body}</p>
                {r.merchantResponse ? (
                  <div className="mt-3 rounded-card bg-surface-muted p-3 text-sm text-ink-muted">
                    <p className="font-semibold text-ink">Store response</p>
                    <p>{r.merchantResponse.body}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {firebaseUser && appUser ? (
          <form onSubmit={handleSubmitReview} className="space-y-3 rounded-card border border-surface-muted bg-surface p-4">
            <p className="text-sm font-semibold text-ink">Write a review</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setReviewRating(n as 1 | 2 | 3 | 4 | 5)}
                  className={n <= reviewRating ? "text-accent-dark" : "text-ink-muted"}
                  aria-label={`${n} star`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              required
              minLength={5}
              rows={3}
              placeholder="Share what you thought about this product"
              className="w-full rounded-card border border-surface-muted p-3 text-sm outline-none focus:border-brand"
            />
            {reviewError ? <p className="text-sm text-red-600">{reviewError}</p> : null}
            <Button type="submit" loading={submittingReview} size="sm">
              Submit review
            </Button>
          </form>
        ) : (
          <p className="text-sm text-ink-muted">
            <a href="/login" className="font-medium text-brand">Sign in</a> to write a review.
          </p>
        )}
      </section>

      {related.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-ink">Recommended for you</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="aspect-square animate-pulse rounded-card bg-surface-muted" />
      <div className="space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-24 w-full animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  );
}
