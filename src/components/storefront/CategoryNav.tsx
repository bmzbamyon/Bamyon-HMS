import Link from "next/link";
import type { Category } from "@/types";

export function CategoryNav({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;
  return (
    <nav className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/category/${c.slug}`}
          className="whitespace-nowrap rounded-full border border-surface-muted bg-surface px-4 py-1.5 text-sm font-medium text-ink hover:border-brand hover:text-brand"
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
