"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingStatus } from "./LoadingStatus";

/** A failed data region can retry without discarding the surrounding navigation. */
export function DataLoadError({ title }: { title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <section className="mx-auto max-w-3xl px-4 py-10">
    <p role="alert">{title} Your account and navigation remain available.</p>
    {pending && <LoadingStatus compact className="mt-4" title="Retrying this section" state="connecting" />}
    <button type="button" className="dashboard-secondary-action mt-4" disabled={pending}
      onClick={() => startTransition(() => router.refresh())}>Try again</button>
  </section>;
}
