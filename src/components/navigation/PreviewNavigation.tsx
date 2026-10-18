import Link from "next/link";

/** Public navigation only; the preview's authorization/data stays in its page. */
export function PreviewNavigation({ complete = false }: { complete?: boolean }) {
  return <div data-preview-bar="" className="border-b border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface-muted)] px-4 py-3 text-[color:var(--workspace-ink)]">
    <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold">{complete ? "Private details · Your preview" : "Public introduction · Draft preview"}</span>
      <nav aria-label="Preview navigation" className="grid grid-cols-2 gap-2 sm:flex">
        <Link href="/dashboard?edit=1" className="workspace-focus inline-flex min-h-11 items-center justify-center rounded-lg border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface)] px-4 text-sm font-semibold">{complete ? "Edit introduction" : "Back to editing"}</Link>
        <Link href="/dashboard" className="workspace-focus inline-flex min-h-11 items-center justify-center rounded-lg border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface)] px-4 text-sm font-semibold">Dashboard</Link>
      </nav>
    </div>
  </div>;
}
