// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const resolve = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error("REDIRECT " + url); }));
vi.mock("@/lib/auth", () => ({ getApiUser: auth }));
vi.mock("@/features/family-viewers/server/family-dashboard.service", () => ({ resolveFamilyDashboard: resolve }));
vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/theme/ThemeSwitch", () => ({ ThemeSwitch: () => <button>Theme</button> }));
import Page, { metadata } from "../src/app/family/page";

const reference = `bir_${"a".repeat(32)}`;
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ status: "authenticated", supabase: {} });
  resolve.mockResolvedValue({ available: true, introductions: [], nextCursor: null });
});

it("renders a private read-only empty dashboard", async () => {
  render(await Page({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "No introductions to show yet" })).toBeVisible();
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(screen.queryByRole("button", { name: /interested|decline/i })).not.toBeInTheDocument();
});

it("shows lifecycle metadata and a bounded older-page link", async () => {
  resolve.mockResolvedValue({
    available: true, introductions: [
      { introductionRef: reference, candidateNames: ["Candidate A"], status: "mutual",
        createdAt: "2026-11-01T12:00:00Z", responseDueAt: "2026-11-16T12:00:00Z" },
    ],
    nextCursor: { createdAt: "2026-11-01T12:00:00Z", introductionRef: reference },
  });
  render(await Page({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Supporting Candidate A")).toBeVisible();
  expect(screen.getByText("Both interested")).toBeVisible();
  expect(screen.getByRole("link", { name: "Older introductions" }).getAttribute("href")).toContain("beforeRef=bir_");
  expect(screen.queryByRole("link", { name: /view profile|complete portfolio/i })).not.toBeInTheDocument();
});

it("shows neutral unavailability and recoverable data errors", async () => {
  resolve.mockResolvedValueOnce({ available: false });
  const view = render(await Page({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "Family access is unavailable" })).toBeVisible();
  view.unmount();
  resolve.mockRejectedValueOnce(new Error("offline"));
  render(await Page({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toHaveTextContent("We could not load family introductions.");
});

it("rejects malformed page cursors without a database read", async () => {
  render(await Page({ searchParams: Promise.resolve({ beforeRef: reference }) }));
  expect(screen.getByRole("heading", { name: "This page link is incomplete" })).toBeVisible();
  expect(resolve).not.toHaveBeenCalled();
});

it("returns signed-out family users to a continuation and handles auth outages", async () => {
  auth.mockResolvedValueOnce({ status: "missing_session" });
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /login?redirect=%2Ffamily");
  auth.mockResolvedValueOnce({ status: "service_unavailable" });
  render(await Page({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toHaveTextContent("We could not load family introductions.");
  expect(resolve).not.toHaveBeenCalled();
});
