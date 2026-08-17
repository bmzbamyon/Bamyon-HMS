"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listCustomers } from "@/lib/firestore/users";
import type { AppUser } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listCustomers().then((c) => {
      setCustomers(c);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.referralCode.toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Customers</h1>
        <p className="text-sm text-ink-muted">{customers.length} registered</p>
      </div>

      <input
        placeholder="Search by name, email, phone, or referral code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md rounded-card border border-surface-muted px-3 py-2 text-sm"
      />

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No customers match your search." : "No customers yet."}
          description={search ? undefined : "Registered customers will appear here."}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-muted bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-muted bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Referral code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted">
              {filtered.map((c) => (
                <tr key={c.uid}>
                  <td className="px-4 py-3 font-medium text-ink">
                    <Link href={`/admin/customers/${c.uid}`} className="hover:text-brand">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.email}</td>
                  <td className="px-4 py-3 capitalize text-ink-muted">{c.status.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{c.referralCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
