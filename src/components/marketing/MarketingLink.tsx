"use client";
import Link from "next/link";
import { track } from "@vercel/analytics";
import type { ComponentProps } from "react";

const events = { create: "Landing Create selected", sample: "Landing Sample opened" } as const;
const marketingPaths = new Set(["/", "/landing/control", "/landing/story", "/landing/family"]);

/** No identity, URL, form value, placement or destination is attached to an event. */
export function recordMarketingAction(action: keyof typeof events) {
  if (process.env.NEXT_PUBLIC_MARKETING_EVENTS_ENABLED !== "true" || !marketingPaths.has(window.location.pathname)) return;
  try { track(events[action]); } catch { /* Measurement must never block navigation. */ }
}
export function MarketingLink({ action, ...props }: Omit<ComponentProps<typeof Link>, "onClick"> & { action: keyof typeof events }) {
  return <Link {...props} onClick={() => recordMarketingAction(action)} />;
}
