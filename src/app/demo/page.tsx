import type { Metadata } from "next";
import Link from "next/link";
import { BiodataTemplate } from "@/components/templates";
import { demoPortfolio } from "@/features/demo/portfolio";

export const metadata: Metadata = { title: "Example introduction", description: "Explore a fictional VivIntro marriage introduction and see how private sharing works.", alternates: { canonical: "/demo" } };

export default function DemoPage() {
  const action = <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface)] p-6 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-[color:var(--workspace-ink)]">Try the viewer path</p><h2 className="mt-2 text-2xl font-semibold">Want to continue?</h2><p className="mt-3 leading-7 text-[color:var(--workspace-muted)]">On a real introduction, you would confirm your email and show interest in getting to know the person. This fictional sample does not collect or submit anything.</p><Link href="/received-a-link" className="dashboard-secondary-action mt-5 inline-flex">See how showing interest works</Link></div>;
  return <div><div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-[color:var(--workspace-ink)] px-4 py-3 text-center text-sm text-[color:var(--workspace-canvas)]"><strong>Fictional sample introduction</strong><span>·</span><span>No personal data or interest is collected here.</span><Link href="/" prefetch={false} className="font-semibold underline underline-offset-4">Back to VivIntro</Link></div><BiodataTemplate templateId={1} data={demoPortfolio} sunSign="Aries" accessMode="public" interestAction={action} /></div>;
}
