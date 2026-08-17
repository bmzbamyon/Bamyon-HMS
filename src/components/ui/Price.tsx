import { formatMoney } from "@/lib/money";

export function Price({
  amountMinor,
  currency,
  compareAtMinor,
  size = "md",
}: {
  amountMinor: number;
  currency: string;
  compareAtMinor?: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];
  const hasDiscount = !!compareAtMinor && compareAtMinor > amountMinor;
  const discountPercent = hasDiscount
    ? Math.round((1 - amountMinor / compareAtMinor!) * 100)
    : 0;

  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`font-display font-bold text-brand ${sizeClass}`}>
        {formatMoney(amountMinor, currency)}
      </span>
      {hasDiscount ? (
        <>
          <span className="text-sm text-ink-muted line-through">
            {formatMoney(compareAtMinor!, currency)}
          </span>
          <span className="text-xs font-semibold text-accent-dark">-{discountPercent}%</span>
        </>
      ) : null}
    </span>
  );
}
