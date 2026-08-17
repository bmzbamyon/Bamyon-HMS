"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllAttendance } from "@/lib/firestore/attendance";
import type { StaffAttendanceEntry } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";

function formatDuration(clockInAt: number, clockOutAt: number | null): string {
  const end = clockOutAt ?? Date.now();
  const minutes = Math.round((end - clockInAt) / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m${clockOutAt ? "" : " (ongoing)"}`;
}

export default function AdminAttendancePage() {
  const [entries, setEntries] = useState<StaffAttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAllAttendance().then((e) => {
      setEntries(e);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.staffName.toLowerCase().includes(q));
  }, [entries, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Staff attendance</h1>
        <p className="text-sm text-ink-muted">Full clock in/out history for every staff member.</p>
      </div>

      <input
        placeholder="Search by staff name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md rounded-card border border-surface-muted px-3 py-2 text-sm"
      />

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No attendance recorded yet." description="Clock-ins from the admin topbar will appear here." />
      ) : (
        <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
          {filtered.map((e) => (
            <li key={e.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium text-ink">{e.staffName}</p>
                <p className="text-xs text-ink-muted">
                  {new Date(e.clockInAt).toLocaleString()} → {e.clockOutAt ? new Date(e.clockOutAt).toLocaleString() : "still clocked in"}
                </p>
              </div>
              <span className={`text-xs font-semibold ${e.clockOutAt ? "text-ink-muted" : "text-brand"}`}>
                {formatDuration(e.clockInAt, e.clockOutAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
