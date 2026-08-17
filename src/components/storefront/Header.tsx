"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useStore } from "@/lib/theme/ThemeProvider";
import { readLocalCart } from "@/lib/firestore/cart";
import { subscribeToNotifications, markNotificationRead } from "@/lib/firestore/notifications";
import type { AppNotification } from "@/types";

export function Header() {
  const { appUser, firebaseUser } = useAuth();
  const { store } = useStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    setCartCount(readLocalCart().reduce((sum, i) => sum + i.quantity, 0));
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    return subscribeToNotifications(firebaseUser.uid, setNotifications);
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) router.push(`/shop?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="print-hide sticky top-0 z-40 border-b border-surface-muted bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-brand">
          {store?.branding?.logoUrl ? (
            <Image src={store.branding.logoUrl} alt={store.name} width={32} height={32} className="rounded object-contain" />
          ) : null}
          {store?.name?.toUpperCase() ?? "BAMYON-IMS"}
        </Link>

        <form onSubmit={submitSearch} className="hidden flex-1 sm:block">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder="Search products, categories & more…"
            className="w-full rounded-card border border-surface-muted bg-surface-muted px-4 py-2 text-sm outline-none focus:border-brand"
            aria-label="Search products"
          />
        </form>

        <nav className="ml-auto flex items-center gap-4 text-sm font-medium text-ink">
          {firebaseUser ? (
            <div className="relative">
              <button
                onClick={() => setShowNotifications((s) => !s)}
                className="relative flex h-6 w-6 items-center justify-center"
                aria-label="Notifications"
              >
                🔔
                {unreadCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {showNotifications ? (
                <div className="absolute right-0 mt-2 w-64 rounded-card border border-surface-muted bg-surface p-2 shadow-lg">
                  {notifications.length === 0 ? (
                    <p className="p-3 text-sm text-ink-muted">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => !n.readAt && markNotificationRead(n.id)}
                        className={`block w-full rounded-card px-2 py-2 text-left text-xs ${
                          n.readAt ? "text-ink-muted" : "bg-brand-light font-medium text-brand-dark"
                        }`}
                      >
                        {n.title}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <Link href="/cart" className="relative">
            Cart
            {cartCount > 0 ? (
              <span className="absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-brand-dark">
                {cartCount}
              </span>
            ) : null}
          </Link>
          {firebaseUser ? (
            <Link href="/account">{appUser?.name ?? "Account"}</Link>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </div>
      <form onSubmit={submitSearch} className="px-4 pb-3 sm:hidden">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
          placeholder="Search products…"
          className="w-full rounded-card border border-surface-muted bg-surface-muted px-4 py-2 text-sm outline-none focus:border-brand"
          aria-label="Search products"
        />
      </form>
    </header>
  );
}
