"use client";

import { useEffect } from "react";

/** Catches render/client errors anywhere in the app, reports them to the
 *  platform error log, and shows a minimal recovery screen. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "client",
          message: error.message || "Client render error",
          detail: { digest: error.digest, stack: error.stack },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ color: "#555", marginTop: 8 }}>
          The error has been logged. Please try again.
        </p>
        <button
          onClick={reset}
          style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: 0, cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
