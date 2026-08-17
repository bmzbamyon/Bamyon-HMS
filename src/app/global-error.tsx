"use client";

import { useEffect } from "react";
import { logError } from "@/lib/firestore/errorLog";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError({ error, context: "root-layout" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontWeight: 700, fontSize: "1.25rem" }}>Something went wrong.</h1>
        <p style={{ color: "#5B6A65", marginTop: "0.5rem" }}>
          This has been logged automatically.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "12px",
            background: "#0B4033",
            color: "white",
            border: "none",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
