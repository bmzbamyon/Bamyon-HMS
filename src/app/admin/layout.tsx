"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { isStaffOrAdmin } from "@/lib/auth/permissions";

/**
 * UI-level gate only — Firestore Security Rules are what actually stop a
 * non-admin/staff user from reading or writing admin data even if they
 * bypass this layout (e.g. by calling the client SDK directly from devtools).
 * See firestore.rules `isAdminOrStaffWith()`.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { appUser, loading } = useAuth();

  if (loading) return <div className="p-8 text-sm text-ink-muted">Loading…</div>;

  if (!isStaffOrAdmin(appUser)) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-display text-xl font-bold text-ink">Admin access required</p>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in with an admin or staff account to reach the command center.
        </p>
        <a href="/login?next=/admin" className="mt-4 inline-block text-brand">Sign in →</a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <AdminSidebar />
      <div className="flex-1">
        <AdminTopbar />
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
