"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getProduct,
  updateProduct,
  getProductVariants,
  createVariant,
  updateVariant,
} from "@/lib/firestore/products";
import { listCategories } from "@/lib/firestore/categories";
import type { Category, Product, ProductMedia, Variant } from "@/types";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { toMinorUnits } from "@/lib/money";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";

export default function AdminProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function refresh() {
    const [p, v, c] = await Promise.all([
      getProduct(params.id),
      getProductVariants(params.id),
      listCategories(),
    ]);
    setProduct(p);
    setVariants(v);
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [params.id]);

  if (loading) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (!product) return <p className="text-sm text-ink-muted">Product not found.</p>;

  async function saveField(patch: Partial<Product>) {
    setSaving(true);
    await updateProduct(product!.id, patch);
    setProduct({ ...product!, ...patch });
    setSavedMsg("Saved.");
    setSaving(false);
    setTimeout(() => setSavedMsg(null), 1500);
  }

  function toggleCategory(catId: string) {
    const has = product!.categoryIds.includes(catId);
    const next = has ? product!.categoryIds.filter((c) => c !== catId) : [...product!.categoryIds, catId];
    saveField({ categoryIds: next });
  }

  async function togglePublish() {
    if (variants.length === 0) {
      alert("Add at least one variant with a price and stock before publishing.");
      return;
    }
    await saveField({ status: product!.status === "published" ? "draft" : "published" });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <button onClick={() => router.push("/admin/products")} className="text-sm text-brand">
        ← Back to products
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{product.title}</h1>
          <p className="text-sm text-ink-muted">/{product.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedMsg ? <span className="text-xs text-ink-muted">{savedMsg}</span> : null}
          <Button variant={product.status === "published" ? "ghost" : "primary"} size="sm" onClick={togglePublish}>
            {product.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Media</p>
        <MediaUploader
          folder={`products/${product.id}`}
          media={product.media}
          onChange={(media: ProductMedia[]) => saveField({ media })}
        />
      </section>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Details</p>
        <textarea
          defaultValue={product.description}
          onBlur={(e) => saveField({ description: e.target.value })}
          rows={4}
          className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
        />
        <input
          defaultValue={product.brand ?? ""}
          onBlur={(e) => saveField({ brand: e.target.value })}
          placeholder="Brand"
          className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleCategory(c.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                product.categoryIds.includes(c.id)
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-surface-muted text-ink-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={product.affiliateEnabled}
            onChange={(e) => saveField({ affiliateEnabled: e.target.checked })}
          />
          Enable affiliate commission for this product
        </label>
        {product.affiliateEnabled ? (
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Commission %"
              defaultValue={product.affiliateCommission?.value}
              onBlur={(e) =>
                saveField({ affiliateCommission: { type: "percent", value: Number(e.target.value) } })
              }
              className="w-40 rounded-card border border-surface-muted px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </section>

      <VariantEditor productId={product.id} variants={variants} onChanged={refresh} />
    </div>
  );
}

function VariantEditor({
  productId,
  variants,
  onChanged,
}: {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
}) {
  const [sku, setSku] = useState("");
  const [attrs, setAttrs] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [stock, setStock] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const attributes: Record<string, string> = {};
      attrs.split(",").forEach((pair) => {
        const [k, v] = pair.split(":").map((s) => s.trim());
        if (k && v) attributes[k] = v;
      });
      await createVariant(productId, {
        sku,
        attributes,
        priceMinor: toMinorUnits(Number(price), CURRENCY),
        compareAtPriceMinor: compareAt ? toMinorUnits(Number(compareAt), CURRENCY) : undefined,
        currency: CURRENCY,
        stockOnHand: Number(stock) || 0,
        stockReserved: 0,
        lowStockThreshold: 5,
      });
      setSku("");
      setAttrs("");
      setPrice("");
      setCompareAt("");
      setStock("");
      onChanged();
    } finally {
      setCreating(false);
    }
  }

  async function adjustStock(variant: Variant, delta: number) {
    // Manual stock corrections write directly with the audit-relevant
    // fields — a real audit log entry gets written alongside this from
    // the caller in a fuller build; recorded here as an updatedAt bump
    // plus the new value so the change is at least visible in Firestore
    // history via updatedAt ordering.
    await updateVariant(productId, variant.id, {
      stockOnHand: Math.max(0, variant.stockOnHand + delta),
    });
    onChanged();
  }

  return (
    <section className="space-y-4 rounded-card border border-surface-muted bg-surface p-5">
      <p className="font-semibold text-ink">Variants</p>

      {variants.length === 0 ? (
        <p className="text-sm text-ink-muted">No variants yet — add one below before publishing.</p>
      ) : (
        <ul className="divide-y divide-surface-muted">
          {variants.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {Object.values(v.attributes).join(" / ") || v.sku}
                </p>
                <p className="text-xs text-ink-muted">SKU {v.sku}</p>
              </div>
              <Price amountMinor={v.priceMinor} currency={v.currency} compareAtMinor={v.compareAtPriceMinor} size="sm" />
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => adjustStock(v, -1)} className="rounded-card border border-surface-muted px-2">−</button>
                <span>{v.stockOnHand} on hand ({v.stockReserved} reserved)</span>
                <button onClick={() => adjustStock(v, 1)} className="rounded-card border border-surface-muted px-2">+</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="grid gap-2 border-t border-surface-muted pt-4 sm:grid-cols-2">
        <input required placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <input placeholder="Attributes e.g. color:Black, size:M" value={attrs} onChange={(e) => setAttrs(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <input required type="number" placeholder={`Price (${CURRENCY})`} value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <input type="number" placeholder="Compare-at price (optional)" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <input required type="number" placeholder="Starting stock" value={stock} onChange={(e) => setStock(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
        <Button type="submit" loading={creating} size="sm" className="sm:col-span-2">Add variant</Button>
      </form>
    </section>
  );
}
