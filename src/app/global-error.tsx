"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/** Root-layout failures cannot rely on its providers, fonts or stylesheet. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en"><body style={{ margin: 0, background: "#f7f5ef", color: "#243342", fontFamily: "system-ui, sans-serif" }}>
      <main id="main-content" style={{ maxWidth: 520, margin: "15vh auto", padding: 24, textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>We could not load this page. Please try again.</p>
        <button type="button" onClick={reset} style={{ minHeight: 48, padding: "12px 24px", borderRadius: 8, background: "#174d57", color: "#fff", font: "inherit" }}>Try again</button>
      </main>
    </body></html>
  );
}
