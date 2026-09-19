// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const acknowledge = vi.hoisted(() => vi.fn());
const reviewed = vi.hoisted(() => vi.fn());
vi.mock("@/features/broker-introductions/client/broker-introduction.api", () => ({
  acknowledgePortfolioUpdate: acknowledge,
  markIntroductionResponseReviewed: reviewed,
}));

import { BrokerdeskDashboardClient } from "../src/app/brokerdesk/w/[workspaceRef]/dashboard/brokerdesk-dashboard-client";

const workspaceRef = `wrk_${"a".repeat(32)}`;
const relationshipRef = `bcr_${"b".repeat(32)}` as never;
const introductionRef = `bir_${"c".repeat(32)}` as never;
const noticeRef = `bpn_${"d".repeat(32)}` as never;

describe("BrokerDesk workspace dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acknowledge.mockResolvedValue({ available: true, status: "acknowledged" });
    reviewed.mockResolvedValue({ available: true, status: "reviewed" });
  });

  it("shows the isolated operational summary and completes follow-ups", async () => {
    render(<BrokerdeskDashboardClient dashboard={{
      available: true,
      workspaceRef,
      workspaceName: "Ravi Matchmaking",
      metrics: { activeCustomers: 1, openIntroductions: 2, responsesAwaitingReview: 1, portfolioUpdates: 1 },
      actions: [
        { type: "response", occurredAt: "2026-09-19T10:00:00Z", relationshipRef, customerName: "Ananya", introductionRef, recipientLabel: "Priya family", response: "accepted", responseComment: "Please arrange a call." },
        { type: "portfolio_update", occurredAt: "2026-09-19T09:00:00Z", relationshipRef, customerName: "Ananya", noticeRef, versionNumber: 2 },
        { type: "expiring", occurredAt: "2026-09-20T09:00:00Z", relationshipRef, customerName: "Ananya", introductionRef: `bir_${"e".repeat(32)}` as never, recipientLabel: "Arjun family", expiresAt: "2026-09-20T09:00:00Z" },
      ],
    }} />);
    expect(screen.getByRole("heading", { name: "Ravi Matchmaking" })).toBeInTheDocument();
    expect(screen.getByText("Priya family accepted")).toBeInTheDocument();
    expect(screen.getByText("Introduction to Arjun family expires soon")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Mark complete" });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(reviewed).toHaveBeenCalledWith(workspaceRef, introductionRef));
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith(workspaceRef, relationshipRef, noticeRef));
    expect(screen.getByText("Follow-up marked complete.")).toBeInTheDocument();
  });

  it("renders a caught-up workspace", () => {
    render(<BrokerdeskDashboardClient dashboard={{
      available: true, workspaceRef, workspaceName: "Agency",
      metrics: { activeCustomers: 0, openIntroductions: 0, responsesAwaitingReview: 0, portfolioUpdates: 0 }, actions: [],
    }} />);
    expect(screen.getByRole("heading", { name: "You are caught up" })).toBeInTheDocument();
  });
});
