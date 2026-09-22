// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const createIntroduction = vi.hoisted(() => vi.fn());
const markIntroductionShared = vi.hoisted(() => vi.fn());
const revokeIntroduction = vi.hoisted(() => vi.fn());
const flagPortfolioUpdate = vi.hoisted(() => vi.fn());
const acknowledgePortfolioUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/features/broker-introductions/client/broker-introduction.api", () => ({
  createIntroduction, markIntroductionShared, revokeIntroduction, flagPortfolioUpdate, acknowledgePortfolioUpdate,
}));

import { BrokerIntroductionPanel } from "../src/app/brokerdesk/w/[workspaceRef]/customers/[relationshipRef]/broker-introduction-panel";

const introductionRef = `bir_${"a".repeat(32)}` as never;
const noticeRef = `bpn_${"b".repeat(32)}` as never;
const recipientRelationshipRef = `bcr_${"c".repeat(32)}` as never;
const eligibleRecipients = [{ relationshipRef: recipientRelationshipRef, displayName: "New customer", gender: "Female", location: "Bengaluru" }];

describe("broker introduction panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    createIntroduction.mockResolvedValue({ introductionRef, introductionUrl: "https://app.test/introduction", sourceName: "Arun", recipientLabel: "New customer", recipientEmailHint: null, expiresAt: "2026-10-01T00:00:00Z", versionNumber: 4, rowVersion: 1, status: "created" });
    markIntroductionShared.mockResolvedValue({ available: true, status: "shared", rowVersion: 2 });
    revokeIntroduction.mockResolvedValue({ available: true, status: "revoked", rowVersion: 3 });
    flagPortfolioUpdate.mockResolvedValue({ available: true, status: "clarification" });
    acknowledgePortfolioUpdate.mockResolvedValue({ available: true, status: "acknowledged" });
  });

  it("creates, activates, flags, and revokes broker-scoped introductions", async () => {
    render(<BrokerIntroductionPanel
      workspaceRef="wrk_workspace"
      relationshipRef="bcr_relationship"
      canCreate
      eligibleRecipients={eligibleRecipients}
      initialNotices={[{ noticeRef, status: "unread", versionNumber: 4, publishedAt: "2026-09-19T00:00:00Z", createdAt: "2026-09-19T00:00:00Z" }]}
      initialIntroductions={[{ introductionRef, recipientLabel: "Existing family", recipientEmailHint: null, status: "shared", response: null, responseComment: null, respondedAt: null, sourceResponse: null, sourceResponseComment: null, sourceRespondedAt: null, recipientResponse: null, recipientResponseComment: null, recipientRespondedAt: null, mutualInterestConfirmedAt: null, completeAccessExpiresAt: null, expiresAt: "2026-10-01T00:00:00Z", versionNumber: 3, rowVersion: 2, createdAt: "2026-09-18T00:00:00Z" }]}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Flag for clarification" }));
    await screen.findByText(/Flagged for clarification/);
    fireEvent.change(screen.getByLabelText("Introduce this customer to"), { target: { value: recipientRelationshipRef } });
    fireEvent.click(screen.getByRole("button", { name: "Create private introduction" }));
    await screen.findByText("Customer-only introduction link");
    fireEvent.click(screen.getByRole("button", { name: "Activate and copy" }));
    await screen.findByText(/activated and copied/);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://app.test/introduction");
    expect(createIntroduction).toHaveBeenCalledWith("wrk_workspace", expect.objectContaining({ recipientRelationshipRef }));
    const revokeButtons = screen.getAllByRole("button", { name: "Revoke" });
    fireEvent.click(revokeButtons[0]);
    await waitFor(() => expect(revokeIntroduction).toHaveBeenCalled());
  });

  it("acknowledges an isolated portfolio update", async () => {
    render(<BrokerIntroductionPanel workspaceRef="wrk" relationshipRef="bcr" canCreate={false}
      eligibleRecipients={[]}
      initialNotices={[{ noticeRef, status: "clarification", versionNumber: 4, publishedAt: "2026-09-19T00:00:00Z", createdAt: "2026-09-19T00:00:00Z" }]}
      initialIntroductions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    await screen.findByText("Portfolio update acknowledged.");
    expect(acknowledgePortfolioUpdate).toHaveBeenCalledWith("wrk", "bcr", noticeRef);
  });

  it("explains when the relationship cannot create introductions", () => {
    render(<BrokerIntroductionPanel workspaceRef="wrk" relationshipRef="bcr" canCreate={false} eligibleRecipients={[]} initialNotices={[]} initialIntroductions={[]} />);
    expect(screen.getByText(/active mandate/)).toBeInTheDocument();
    expect(screen.getByText("No broker introductions yet.")).toBeInTheDocument();
  });
});
