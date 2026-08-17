"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  createStaffInvite,
  listStaffInvites,
  listStaffProfiles,
  updateStaffPermissions,
  setStaffStatus,
  PERMISSION_GROUPS,
} from "@/lib/firestore/staff";
import type { Permission, StaffInvite, StaffProfile } from "@/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { writeAuditLog } from "@/lib/firestore/audit";

export default function AdminStaffPage() {
  const { appUser } = useAuth();
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    const [i, p] = await Promise.all([listStaffInvites(), listStaffProfiles()]);
    setInvites(i);
    setProfiles(p);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function togglePermission(p: Permission) {
    setSelectedPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    setInviting(true);
    try {
      await createStaffInvite({
        email,
        label: label || "Custom staff role",
        permissions: selectedPermissions,
        invitedByUid: appUser.uid,
      });
      await writeAuditLog({
        actorId: appUser.uid,
        action: "staff.invite",
        targetType: "staffInvite",
        targetId: email,
        after: { permissions: selectedPermissions, label },
      });
      setEmail("");
      setLabel("");
      setSelectedPermissions([]);
      await refresh();
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Staff &amp; roles</h1>
        <p className="text-sm text-ink-muted">
          Invite by email with a custom permission set. The invited person gets staff access
          automatically the moment they register with that email — no separate login system to manage.
        </p>
      </div>

      <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <p className="font-semibold text-ink">Invite staff member</p>
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-card border border-surface-muted px-3 py-2 text-sm"
            />
            <input
              placeholder="Role label (e.g. Order Manager)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="rounded-card border border-surface-muted px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{group.label}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {group.permissions.map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => togglePermission(p)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        selectedPermissions.includes(p)
                          ? "border-brand bg-brand-light text-brand-dark"
                          : "border-surface-muted text-ink-muted"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button type="submit" size="sm" loading={inviting} disabled={selectedPermissions.length === 0}>
            Send invite
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <p className="font-semibold text-ink">Pending invites</p>
        {invites.length === 0 ? (
          <p className="text-sm text-ink-muted">No invites sent yet.</p>
        ) : (
          <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
            {invites.map((inv) => (
              <li key={inv.email} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium text-ink">{inv.email}</p>
                  <p className="text-xs text-ink-muted">{inv.label} · {inv.permissions.length} permissions</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <p className="font-semibold text-ink">Active staff</p>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : profiles.length === 0 ? (
          <EmptyState title="No staff members yet." description="Once someone accepts an invite, they'll appear here." />
        ) : (
          <ul className="space-y-2">
            {profiles.map((p) => (
              <li key={p.uid} className="rounded-card border border-surface-muted bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{p.uid}</p>
                  <div className="flex gap-2">
                    <span className={`text-xs ${p.status === "active" ? "text-brand" : "text-red-600"}`}>
                      {p.status}
                    </span>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={async () => {
                        const newStatus = p.status === "active" ? "suspended" : "active";
                        await setStaffStatus(p.uid, newStatus);
                        await writeAuditLog({
                          actorId: appUser?.uid ?? "admin",
                          action: "staff.status_change",
                          targetType: "staffProfile",
                          targetId: p.uid,
                          before: { status: p.status },
                          after: { status: newStatus },
                        });
                        refresh();
                      }}
                    >
                      {p.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.permissions.map((perm) => (
                    <span key={perm} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                      {perm}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
