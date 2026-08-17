"use client";

import { useEffect, useState } from "react";
import { listCategories, createCategory } from "@/lib/firestore/categories";
import type { Category } from "@/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setCategories(await listCategories());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createCategory({ name, slug: slugify(name), sortOrder: categories.length });
      setName("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">Categories</h1>

      <form onSubmit={handleCreate} className="flex gap-2 rounded-card border border-surface-muted bg-surface p-4">
        <input
          required
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-card border border-surface-muted px-3 py-2 text-sm"
        />
        <Button type="submit" loading={creating} size="sm">Add category</Button>
      </form>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : categories.length === 0 ? (
        <EmptyState title="No categories yet." description="Categories help customers browse and filter the catalogue." />
      ) : (
        <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
          {categories.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm text-ink">{c.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
