"use client";

import { useEffect, useState } from "react";
import {
  listAllSectionsForAdmin,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from "@/lib/firestore/homepageSections";
import { listCategories } from "@/lib/firestore/categories";
import type { Category, HomepageSection, HomepageSectionSource } from "@/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminHomepagePage() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<HomepageSectionSource>("all_published");
  const [categoryId, setCategoryId] = useState("");
  const [take, setTake] = useState("10");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const [s, c] = await Promise.all([listAllSectionsForAdmin(), listCategories()]);
    setSections(s);
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
      await createSection({
        title,
        sourceType,
        categoryId: sourceType === "category" ? categoryId : null,
        productIds: [],
        take: Number(take) || 10,
        enabled: true,
        sortOrder: sections.length,
      });
      setTitle("");
      setShowForm(false);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...sections];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
    setSections(next);
    await reorderSections(next.map((s) => s.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Homepage sections</h1>
          <p className="text-sm text-ink-muted">
            Reorder, rename, and toggle the product rows shown on the homepage — no redeploy needed.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ Add section"}</Button>
      </div>

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <input required placeholder="Section title (e.g. Trending Now)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as HomepageSectionSource)} className="rounded-card border border-surface-muted px-3 py-2 text-sm">
              <option value="all_published">All published products</option>
              <option value="category">A specific category</option>
              <option value="manual">Manually chosen products (configure later)</option>
            </select>
            {sourceType === "category" ? (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm">
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : null}
            <input type="number" placeholder="How many products" value={take} onChange={(e) => setTake(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
          </div>
          <Button type="submit" size="sm" loading={creating}>Add section</Button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : sections.length === 0 ? (
        <EmptyState title="No custom sections yet." description="The homepage falls back to a single 'New arrivals' row until you add one." />
      ) : (
        <ul className="space-y-2">
          {sections.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between rounded-card border border-surface-muted bg-surface p-4">
              <div>
                <p className="font-medium text-ink">{s.title}</p>
                <p className="text-xs text-ink-muted">
                  {s.sourceType === "all_published" ? "All published products" : s.sourceType === "category" ? `Category: ${categories.find((c) => c.id === s.categoryId)?.name ?? "unknown"}` : "Manual selection"} · {s.take} items
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-ink-muted disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="text-ink-muted disabled:opacity-30">↓</button>
                <button
                  onClick={async () => {
                    await updateSection(s.id, { enabled: !s.enabled });
                    refresh();
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${s.enabled ? "bg-brand-light text-brand-dark" : "bg-surface-muted text-ink-muted"}`}
                >
                  {s.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  onClick={async () => {
                    await deleteSection(s.id);
                    refresh();
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
