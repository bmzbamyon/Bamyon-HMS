"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth/AuthProvider";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import { getOpenShift, clockIn, clockOut } from "@/lib/firestore/attendance";
import { subscribeToNotifications, markNotificationRead } from "@/lib/firestore/notifications";
import type { AppNotification, StaffAttendanceEntry } from "@/types";

export function AdminTopbar() {
  const { appUser, firebaseUser, signOutUser } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [openShift, setOpenShift] = useState<StaffAttendanceEntry | null>(null);
  const [clocking, setClocking] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    getOpenShift(firebaseUser.uid).then(setOpenShift);
    // Presence heartbeat — updates lastSeenAt every 30s while this layout
    // is mounted. Combined with a "seen in the last 2 minutes" check on
    // read, this is enough for a lightweight online indicator without a
    // dedicated realtime presence service.
    const ping = () =>
      updateDoc(doc(db, "stores", STORE_ID, "users", firebaseUser.uid), { lastSeenAt: Date.now() }).catch(() => {});
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    return subscribeToNotifications(firebaseUser.uid, setNotifications);
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function toggleShift() {
    if (!firebaseUser || !appUser) return;
    setClocking(true);
    try {
      if (openShift) {
        await clockOut(firebaseUser.uid);
        setOpenShift(null);
      } else {
        await clockIn(firebaseUser.uid, appUser.name);
        setOpenShift(await getOpenShift(firebaseUser.uid));
      }
    } finally {
      setClocking(false);
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) router.push(`/admin/search?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="print-hide sticky top-0 z-30 flex items-center gap-3 border-b border-surface-muted bg-surface px-4 py-3 sm:px-6">
      <form onSubmit={submitSearch} className="flex-1">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
          placeholder="Search customers, orders, products…"
          className="w-full max-w-md rounded-card border border-surface-muted bg-surface-muted px-4 py-2 text-sm outline-none focus:border-brand"
        />
      </form>

      <button
        onClick={toggleShift}
        disabled={clocking}
        className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:block ${
          openShift ? "bg-red-100 text-red-700" : "bg-brand-light text-brand-dark"
        }`}
      >
        {openShift ? "Clock out" : "Clock in"}
      </button>

      <div className="relative">
        <button
          onClick={() => setShowNotifications((s) => !s)}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted"
          aria-label="Notifications"
        >
          🔔
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
        {showNotifications ? (
          <div className="absolute right-0 mt-2 w-72 rounded-card border border-surface-muted bg-surface p-2 shadow-lg">
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

      <div className="flex items-center gap-2">
        <span className="relative">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            {appUser?.name?.[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" />
        </span>
        <button onClick={() => signOutUser()} className="hidden text-xs text-ink-muted hover:text-ink sm:block">
          Sign out
        </button>
      </div>
    </header>
  );
}
