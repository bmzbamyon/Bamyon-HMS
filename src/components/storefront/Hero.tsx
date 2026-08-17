import Link from "next/link";

export function Hero({ storeName }: { storeName: string }) {
  return (
    <section className="overflow-hidden rounded-card bg-brand-light">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-dark">
          {storeName} · Import storefront
        </p>
        <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-tight text-brand-dark sm:text-5xl">
          Find what makes your space yours.
        </h1>
        <p className="max-w-md text-ink-muted">
          A living catalogue — every product, price and piece of stock here is
          real, added by the store's own team.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="rounded-card bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Shop the storefront →
          </Link>
        </div>
      </div>
    </section>
  );
}
