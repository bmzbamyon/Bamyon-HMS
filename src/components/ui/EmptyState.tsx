import type { ReactNode } from "react";

/**
 * Used across the app instead of fake/placeholder data. Per the build
 * brief: "Instead of ₦4,850,000 Revenue when no revenue exists, display ₦0
 * / No recorded revenue yet." This is that pattern, generalized.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-ink-muted/30 bg-surface px-6 py-16 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}
