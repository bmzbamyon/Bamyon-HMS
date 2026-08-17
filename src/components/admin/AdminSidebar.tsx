"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { subscribeToAllConversations } from "@/lib/firestore/chat";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/homepage", label: "Homepage sections" },
  { href: "/admin/campaigns", label: "Campaigns & banners" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/chat", label: "Chat", badgeKey: "chat" as const },
  { href: "/admin/attendance", label: "Staff attendance" },
  { href: "/admin/wallet", label: "Wallet & finance" },
  { href: "/admin/delivery", label: "Delivery zones" },
  { href: "/admin/affiliates", label: "Affiliates & referrals" },
  { href: "/admin/pos", label: "Point of sale" },
  { href: "/admin/staff", label: "Staff & roles" },
  { href: "/admin/theme", label: "Theme studio" },
  { href: "/admin/settings", label: "Store settings" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/errors", label: "Error logs" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    return subscribeToAllConversations((convs) => {
      setUnreadChats(convs.reduce((sum, c) => sum + (c.unreadForStaff > 0 ? 1 : 0), 0));
    });
  }, []);

  return (
    <aside className="print-hide hidden w-60 flex-shrink-0 bg-brand-dark px-4 py-6 text-white lg:block">
      <p className="px-2 font-display text-lg font-extrabold">BAMYON-IMS</p>
      <p className="mb-6 px-2 text-xs uppercase tracking-widest text-white/50">Admin</p>
      <nav className="space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-card px-3 py-2 text-sm font-medium transition ${
                active ? "bg-brand text-white" : "text-white/80 hover:bg-white/10"
              }`}
            >
              {item.label}
              {item.badgeKey === "chat" && unreadChats > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                  {unreadChats > 9 ? "9+" : unreadChats}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
