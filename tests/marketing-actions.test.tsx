// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const capture = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track: capture }));
import { MarketingLink, recordMarketingAction } from "../src/components/marketing/MarketingLink";
afterEach(() => { vi.unstubAllEnvs(); window.history.replaceState({}, "", "/"); });
it("keeps optional counters disabled until explicitly configured", () => {
  vi.stubEnv("NEXT_PUBLIC_MARKETING_EVENTS_ENABLED", "false");
  recordMarketingAction("create");
  expect(capture).not.toHaveBeenCalled();
});
it("sends fixed names without URL, form values, identities or extra properties", () => {
  vi.stubEnv("NEXT_PUBLIC_MARKETING_EVENTS_ENABLED", "true");
  window.history.replaceState({}, "", "/?email=private#token");
  for (const action of ["create", "sample"] as const) recordMarketingAction(action);
  expect(capture.mock.calls).toEqual([["Landing Create selected"], ["Landing Sample opened"]]);
});
it.each(["/signup", "/dashboard", "/p/private-token", "/access/private-grant"])("never records private activity at %s", path => {
  vi.stubEnv("NEXT_PUBLIC_MARKETING_EVENTS_ENABLED", "true");
  window.history.replaceState({}, "", path);
  recordMarketingAction("create");
  expect(capture).not.toHaveBeenCalled();
});
it("measurement failure does not prevent a normal link action", () => {
  vi.stubEnv("NEXT_PUBLIC_MARKETING_EVENTS_ENABLED", "true");
  capture.mockImplementationOnce(() => { throw new Error("unavailable"); });
  render(<MarketingLink action="sample" href="/demo">Open sample</MarketingLink>);
  const link = screen.getByRole("link", { name: "Open sample" });
  expect(() => fireEvent.click(link)).not.toThrow();
  expect(link).toHaveAttribute("href", "/demo");
});
