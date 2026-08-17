"use client";

import { useEffect, useState } from "react";
import { Hero } from "@/components/storefront/Hero";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { CampaignBanners } from "@/components/storefront/CampaignBanners";
import { listCategories } from "@/lib/firestore/categories";
import { getProductVariants, listPublishedProducts } from "@/lib/firestore/products";
import { listActiveCampaigns } from "@/lib/firestore/campaigns";
import { listEnabledSections, resolveSectionProducts } from "@/lib/firestore/homepageSections";
import { useStore } from "@/lib/theme/ThemeProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { subscribeToWishlist } from "@/lib/firestore/wishlist";
import type { Campaign, Category, HomepageSection, Product, Variant } from "@/types";

interface ResolvedSection {
  section: HomepageSection;
  products: Product[];
  variantsByProduct: Record<string, Variant[]>;
}

export default function HomePage() {
  const { store } = useStore();
  const { firebaseUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [resolvedSections, setResolvedSections] = useState<ResolvedSection[]>([]);
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
      const [categoryList, activeCampaigns, sections] = await Promise.all([
        listCategories(),
        listActiveCampaigns(),
        listEnabledSections(),
      ]);
      if (cancelled) return;
      setCategories(categoryList);
      setCampaigns(activeCampaigns);

      // Admin-configurable rows (see /admin/homepage). If the merchant
      // hasn't configured any yet, fall back to a single "New arrivals"
      // row of published products so the homepage is never empty.
      const sectionsToRender: HomepageSection[] =
        sections.length > 0
          ? sections
          : [
              {
                id: "default",
                storeId: "",
                title: "New arrivals",
                sourceType: "all_published",
                take: 20,
                enabled: true,
                sortOrder: 0,
                createdAt: 0,
                updatedAt: 0,
              },
            ];

      const resolved = await Promise.all(
        sectionsToRender.map(async (section) => {
          const products =
            section.id === "default"
              ? await listPublishedProducts({ take: section.take })
              : await resolveSectionProducts(section);
          const variantEntries = await Promise.all(
            products.map(async (p) => [p.id, await getProductVariants(p.id)] as const)
          );
          return { section, products, variantsByProduct: Object.fromEntries(variantEntries) };
        })
      );
      if (cancelled) return;
      setResolvedSections(resolved);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      <Hero storeName={store?.name ?? "Bamyon-IMS"} />
      <CampaignBanners campaigns={campaigns} />
      <CategoryNav categories={categories} />

      {loading ? (
        <GridSkeleton />
      ) : (
        resolvedSections.map(({ section, products, variantsByProduct }) => (
          <section key={section.id}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-bold text-ink">{section.title}</h2>
              {section.subtitle ? <p className="text-sm text-ink-muted">{section.subtitle}</p> : null}
            </div>
            <ProductGrid
              products={products}
              variantsByProduct={variantsByProduct}
              wishlistedIds={wishlistedIds}
              emptyDescription="Once the store publishes products here, they'll appear automatically."
            />
          </section>
        ))
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-card bg-surface-muted" />
      ))}
    </div>
  );
}
