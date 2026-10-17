import Link from "next/link";

/** Same neutral response for malformed, unknown, rotated, unpublished and deleted references. */
export default function PdfIntroductionUnavailable() {
  return <main id="main-content" className="grid min-h-screen place-items-center bg-[var(--workspace-canvas)] px-4 py-16 text-[var(--workspace-ink)]">
    <section className="w-full max-w-xl rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-8 text-center shadow-[var(--ui-shadow-card)]">
      <p className="text-sm font-medium text-[var(--workspace-teal)]">VivIntro</p>
      <h1 className="mt-4 text-3xl font-semibold">Introduction unavailable</h1>
      <p className="mt-4 text-base leading-7 text-[var(--workspace-muted)]">This introduction isn’t available right now. Ask the person who shared it for a current link.</p>
      <Link href="/received-a-link" className="dashboard-secondary-action mt-6 inline-flex min-h-11 items-center justify-center">Read the viewer guide</Link>
    </section>
  </main>;
}
