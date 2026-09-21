import type { Metadata } from "next";
import Link from "next/link";
import { BiodataTemplate } from "@/components/templates";
import { demoPortfolio } from "@/features/demo/portfolio";

export const metadata: Metadata = { title: "Demo introduction", description: "Explore a fictional VivIntro marriage introduction and see how protected access works.", alternates: { canonical: "/demo" } };

export default function DemoPage() {
  const action = <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-[#d0d3ce] bg-[#fffdf8] p-6 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#477b77]">Demo only</p><h2 className="mt-2 text-2xl font-semibold">Interested in continuing?</h2><p className="mt-3 leading-7 text-slate-600">On a real portfolio, you would confirm your email and ask the owner for protected access. Nothing is submitted from this fictional demo.</p><Link href="/received-a-link" className="dashboard-secondary-action mt-5 inline-flex">See the viewer journey</Link></div>;
  return <main id="main-content"><div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-[#173e49] px-4 py-3 text-center text-sm text-white"><strong>Fictional demo portfolio</strong><span>·</span><span>No personal data or request is collected here.</span><Link href="/" className="font-semibold underline underline-offset-4">Back to VivIntro</Link></div><BiodataTemplate templateId={1} data={demoPortfolio} sunSign="Aries" accessMode="public" identityVerified interestAction={action} /></main>;
}
