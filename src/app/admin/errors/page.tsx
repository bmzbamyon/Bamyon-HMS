"use client";

import { useEffect, useMemo, useState } from "react";
import { listErrorLogs } from "@/lib/firestore/errorLog";
import type { ErrorLogEntry } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminErrorsPage() {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"all" | "error" | "warning">("all");

  useEffect(() => {
    listErrorLogs().then((l) => {
      setLogs(l);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (severity !== "all" && l.severity !== severity) return false;
      if (search && !l.message.toLowerCase().includes(search.toLowerCase()) && !l.context.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, search, severity]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Error logs</h1>
        <p className="text-sm text-ink-muted">
          Every logged failure across the storefront, checkout, and admin actions — searchable, not
          buried in a browser console only you can see.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Search message or context…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-card border border-surface-muted px-3 py-2 text-sm"
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as typeof severity)}
          className="rounded-card border border-surface-muted px-3 py-2 text-sm"
        >
          <option value="all">All severities</option>
          <option value="error">Errors</option>
          <option value="warning">Warnings</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No errors logged." description="Clean bill of health — nothing has failed and been recorded yet." />
      ) : (
        <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
          {filtered.map((log) => (
            <li key={log.id} className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className={`font-medium ${log.severity === "error" ? "text-red-600" : "text-accent-dark"}`}>
                  {log.message}
                </span>
                <span className="text-xs text-ink-muted">{log.context}</span>
              </div>
              {log.userId ? <p className="mt-1 text-xs text-ink-muted">user: {log.userId}</p> : null}
              {log.stack ? (
                <pre className="mt-2 overflow-x-auto rounded bg-surface-muted p-2 text-xs text-ink-muted">{log.stack}</pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
