"use client";

import { useEffect, useState } from "react";
import { listAuditLogs } from "@/lib/firestore/audit";
import type { AuditLogEntry } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAuditLogs().then((l) => {
      setLogs(l);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Audit log</h1>
        <p className="text-sm text-ink-muted">
          Every sensitive action — wallet adjustments, refunds, staff permission changes — recorded
          with who did it and what changed.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : logs.length === 0 ? (
        <EmptyState title="No audit entries yet." description="Sensitive admin actions will be logged here as they happen." />
      ) : (
        <ul className="divide-y divide-surface-muted rounded-card border border-surface-muted bg-surface">
          {logs.map((log) => (
            <li key={log.id} className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{log.action}</span>
                <span className="text-xs text-ink-muted">{log.actorId}</span>
              </div>
              <p className="text-xs text-ink-muted">
                {log.targetType} · {log.targetId}
              </p>
              {log.after ? (
                <pre className="mt-1 overflow-x-auto rounded bg-surface-muted p-2 text-xs text-ink-muted">
                  {JSON.stringify(log.after, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
