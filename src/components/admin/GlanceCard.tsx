import Link from "next/link";
import type { ReactNode } from "react";

export function GlanceCard({
  href,
  label,
  value,
  hint,
  trend,
  icon,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
  trend?: { value: string; positive: boolean };
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-card border border-surface-muted bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-light text-lg text-brand-dark">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="font-display text-xl font-bold text-ink">{value}</p>
        {trend ? (
          <p className={`text-xs font-medium ${trend.positive ? "text-brand" : "text-red-600"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        ) : hint ? (
          <p className="text-xs text-ink-muted">{hint}</p>
        ) : null}
      </div>
    </Link>
  );
}
