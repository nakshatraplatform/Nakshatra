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
  "/faq",
]);

/** Keeps capability URLs, account routes, query strings, and private product activity out of traffic analytics. */
export function filterPublicAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL;
  try { url = new URL(event.url); } catch { return null; }
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
  if (event.type === "event" && process.env.NEXT_PUBLIC_MARKETING_EVENTS_ENABLED !== "true") return null;
  if (event.type === "event" && !["/", "/landing/control", "/landing/story", "/landing/family"].includes(pathname)) return null;
  if (event.type === "event") {
    url.pathname = pathname; url.search = ""; url.hash = "";
    return { type: "event", url: url.toString() };
  }
  if (!MEASURED_PUBLIC_PATHS.has(pathname)) return null;
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function PrivacySafeAnalytics() {
  return <Analytics beforeSend={filterPublicAnalyticsEvent} />;
}
