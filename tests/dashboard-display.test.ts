import { describe, expect, it } from "vitest";
import {
  daysUntilDashboardDate,
  formatDashboardAccessDate,
  formatDashboardInterestDate,
} from "@/features/access/client/dashboard-display";

describe("dashboard date display", () => {
  it("formats server timestamps in one explicit timezone", () => {
    const timestamp = "2026-09-21T00:30:00.000Z";

    expect(formatDashboardAccessDate(timestamp)).toBe("Sep 21, 2026");
    expect(formatDashboardInterestDate(timestamp)).toBe("Sep 21");
  });

  it("uses the server-provided render time for expiry urgency", () => {
    expect(daysUntilDashboardDate(
      "2026-09-24T12:00:00.000Z",
      "2026-09-21T12:00:00.000Z"
    )).toBe(3);
    expect(daysUntilDashboardDate("invalid", "2026-09-21T12:00:00.000Z")).toBe(Number.POSITIVE_INFINITY);
  });
});
