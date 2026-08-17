"use client";

import { useEffect } from "react";
import { logError } from "@/lib/firestore/errorLog";
import { Button } from "@/components/ui/Button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError({ error, context: typeof window !== "undefined" ? window.location.pathname : "unknown" });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <p className="font-display text-xl font-bold text-ink">Something went wrong.</p>
      <p className="text-sm text-ink-muted">
        This has been logged automatically. You can try again, or head back to the homepage.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">Try again</Button>
        <a href="/">
          <Button variant="ghost" size="sm">Go home</Button>
        </a>
      </div>
    </div>
  );
}
