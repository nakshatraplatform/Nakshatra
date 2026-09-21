"use client";

import { useSyncExternalStore } from "react";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

function subscribeToDashboardClock(onChange: () => void) {
  const interval = window.setInterval(onChange, MINUTE_MS);
  return () => window.clearInterval(interval);
}

/** Uses the server render time for hydration, then advances with the browser clock. */
export function useDashboardClock(renderedAt: string) {
  return useSyncExternalStore(
    subscribeToDashboardClock,
    () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS,
    () => new Date(renderedAt).getTime()
  );
}

/** Formats persisted timestamps consistently during server rendering and hydration. */
export function formatDashboardAccessDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDashboardInterestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Uses the request render time so expiry labels cannot change while React hydrates. */
export function daysUntilDashboardDate(value: string, referenceTime: string | number) {
  const parsedReference = typeof referenceTime === "number"
    ? referenceTime
    : new Date(referenceTime).getTime();
  const difference = new Date(value).getTime() - parsedReference;
  return Number.isFinite(difference) ? Math.ceil(difference / DAY_MS) : Number.POSITIVE_INFINITY;
}
