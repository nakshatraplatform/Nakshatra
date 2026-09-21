import { describe, expect, it } from "vitest";
import { filterPublicAnalyticsEvent } from "../src/components/analytics/PrivacySafeAnalytics";

describe("privacy-safe traffic analytics", () => {
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
