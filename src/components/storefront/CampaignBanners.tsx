import Link from "next/link";
import Image from "next/image";
import type { Campaign } from "@/types";

export function CampaignBanners({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) return null;

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const content = (
          <div
            className="flex flex-col items-start gap-3 overflow-hidden rounded-card p-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ backgroundColor: c.backgroundColor || "var(--color-brand)" }}
          >
            <div className="text-white">
              <p className="font-display text-xl font-bold">{c.title}</p>
              {c.subtitle ? <p className="mt-1 text-sm text-white/80">{c.subtitle}</p> : null}
              {c.linkHref && c.ctaLabel ? (
                <span className="mt-3 inline-block rounded-card bg-white px-4 py-2 text-sm font-semibold text-brand">
                  {c.ctaLabel}
                </span>
              ) : null}
            </div>
            {c.imageUrl ? (
              <div className="relative h-24 w-full flex-shrink-0 sm:h-20 sm:w-32">
                <Image src={c.imageUrl} alt={c.title} fill className="object-contain" />
              </div>
            ) : null}
          </div>
        );
        return c.linkHref ? (
          <Link key={c.id} href={c.linkHref}>
            {content}
          </Link>
        ) : (
          <div key={c.id}>{content}</div>
        );
      })}
    </div>
  );
}
