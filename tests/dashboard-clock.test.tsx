// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardClock } from "@/features/access/client/dashboard-display";

function ClockProbe({ renderedAt }: { renderedAt: string }) {
  return <output>{useDashboardClock(renderedAt)}</output>;
}

describe("dashboard clock", () => {
  afterEach(() => vi.useRealTimers());

  it("advances after hydration so urgency labels do not remain frozen", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-21T12:00:30.000Z");
    render(<ClockProbe renderedAt="2026-09-21T11:59:00.000Z" />);
    expect(screen.getByRole("status")).toHaveTextContent(String(Date.parse("2026-09-21T12:00:00.000Z")));

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(screen.getByRole("status")).toHaveTextContent(String(Date.parse("2026-09-21T12:01:00.000Z")));
  });
});
