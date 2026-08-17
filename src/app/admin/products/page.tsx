"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listAllProductsForAdmin, createProduct } from "@/lib/firestore/products";
import { listCategories } from "@/lib/firestore/categories";
import type { Category, Product } from "@/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const [p, c] = await Promise.all([listAllProductsForAdmin(), listCategories()]);
    setProducts(p);
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const id = await createProduct({
        title,
        slug: slugify(title),
        description,
        categoryIds: categoryId ? [categoryId] : [],
        media: [],
        status: "draft",
        affiliateEnabled: false,
      });
      setTitle("");
      setDescription("");
      setShowForm(false);
      router.push(`/admin/products/${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-dark">Catalogue command</p>
          <h1 className="font-display text-2xl font-bold text-ink">Products &amp; category rows</h1>
          <p className="text-sm text-ink-muted">Every image, variant, stock, price and category is controlled here.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Add product"}</Button>
      </div>

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <input
            required
            placeholder="Product title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">
            New products start as drafts. You'll land on the product's detail page next to add
            variants (price, stock, SKU), upload images, and publish.
          </p>
          <Button type="submit" loading={creating} size="sm">Create draft</Button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : products.length === 0 ? (
        <EmptyState title="No products yet." description="Add your first product to start building the catalogue." />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-muted bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-muted bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-medium text-ink hover:text-brand">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.status === "published"
                          ? "bg-brand-light text-brand-dark"
                          : "bg-surface-muted text-ink-muted"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {p.ratingCount > 0 ? `★ ${p.ratingAverage.toFixed(1)} (${p.ratingCount})` : "No reviews yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
