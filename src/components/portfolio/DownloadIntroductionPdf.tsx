"use client";

import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

/** Existing dashboard action styling; no new controls, theme, or template choices. */
export function DownloadIntroductionPdf() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function download() {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/portfolio/pdf", { method: "POST", signal: controller.signal });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error : "We couldn’t prepare your PDF. Please try again.");
      }
      if (!response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error("We couldn’t prepare your PDF. Please try again.");
      const blob = await response.blob();
      if (!blob.size || blob.size > 2 * 1024 * 1024) throw new Error("We couldn’t prepare your PDF. Please try again.");
      const filename = response.headers.get("content-disposition")?.match(/filename="(vivintro-[a-zA-Z0-9-]+\.pdf)"/)?.[1] || "vivintro-introduction.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      // Safari may consume an attachment asynchronously after the click.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("PDF ready. Check your downloads. This is a dated copy of your public introduction.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Please try downloading again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      pending.current = null;
    }
  }
  return <div className="min-w-0">
    <button type="button" onClick={() => { void download(); }} disabled={loading} aria-busy={loading}
      className="dashboard-secondary-action w-full sm:w-auto">
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
      {loading ? "Preparing PDF…" : "Download PDF"}
    </button>
    {message && <p role="status" className="mt-2 max-w-prose text-sm text-[var(--workspace-muted)]">{message}</p>}
  </div>;
}
