import Link from "next/link";

export function Footer() {
  return (
    <footer className="print-hide mt-16 border-t border-surface-muted bg-brand-dark px-4 py-12 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <p className="font-display text-lg font-bold">BAMYON-IMS</p>
          <p className="mt-2 text-sm text-white/70">
            Import storefront &amp; commerce operating system.
          </p>
        </div>
        <FooterColumn
          title="Shop"
          links={[
            { href: "/shop", label: "All products" },
            { href: "/shop?sort=new", label: "New arrivals" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { href: "/orders", label: "Orders" },
            { href: "/wallet", label: "Wallet" },
            { href: "/account", label: "Dashboard" },
          ]}
        />
        <FooterColumn
          title="Support"
          links={[
            { href: "/account", label: "Help" },
            { href: "/orders", label: "Track an order" },
          ]}
        />
      </div>
      <p className="mx-auto mt-10 max-w-7xl text-xs text-white/50">
        © {new Date().getFullYear()} Bamyon-IMS. All rights reserved.
      </p>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-white/70 hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
