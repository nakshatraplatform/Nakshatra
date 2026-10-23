import { afterEach, describe, expect, it, vi } from "vitest";
import { filterPublicAnalyticsEvent } from "../src/components/analytics/PrivacySafeAnalytics";

describe("privacy-safe traffic analytics", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("rejects malformed URLs and leaves optional events off by default", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_EVENTS_ENABLED", "false");
    expect(filterPublicAnalyticsEvent({ type: "pageview", url: "not a URL" })).toBeNull();
    expect(filterPublicAnalyticsEvent({ type: "event", url: "https://www.vivintro.com/" })).toBeNull();
  });
  it("bounds enabled events to marketing pages and strips query and fragment", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_EVENTS_ENABLED", "true");
    expect(filterPublicAnalyticsEvent({ type: "event", url: "https://www.vivintro.com/?secret=not-sent#private" })).toEqual({ type: "event", url: "https://www.vivintro.com/" });
    for (const path of ["/signup", "/account", "/p/token", "/demo", "/faq"]) expect(filterPublicAnalyticsEvent({ type: "event", url: "https://www.vivintro.com" + path })).toBeNull();
  });
  it("measures fixed public marketing routes without query strings", () => {
    expect(filterPublicAnalyticsEvent({ type: "pageview", url: "https://www.vivintro.com/demo?campaign=pilot" }))
      .toEqual({ type: "pageview", url: "https://www.vivintro.com/demo" });
  });

  it("drops introduction tokens and private product routes", () => {
    expect(filterPublicAnalyticsEvent({ type: "pageview", url: "https://www.vivintro.com/p/private-token" })).toBeNull();
    expect(filterPublicAnalyticsEvent({ type: "pageview", url: "https://www.vivintro.com/brokerdesk/w/private-workspace" })).toBeNull();
    expect(filterPublicAnalyticsEvent({ type: "pageview", url: "https://www.vivintro.com/account" })).toBeNull();
  });
});
