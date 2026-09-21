"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const MEASURED_PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/demo",
  "/privacy",
  "/received-a-link",
  "/terms",
  "/trust",
  "/waitlist",
]);

/** Keeps capability URLs, account routes, query strings, and private product activity out of traffic analytics. */
export function filterPublicAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
  if (!MEASURED_PUBLIC_PATHS.has(pathname)) return null;
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function PrivacySafeAnalytics() {
  return <Analytics beforeSend={filterPublicAnalyticsEvent} />;
}
