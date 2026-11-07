// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const getAction = vi.hoisted(() => vi.fn());
const record = vi.hoisted(() => vi.fn());
const recordUpdate = vi.hoisted(() => vi.fn());
const activate = vi.hoisted(() => vi.fn());
vi.mock("@/features/broker-introductions/client/broker-introduction.api", () => ({ getIntroductionAction: getAction, recordShareAction: record, markIntroductionShared: activate, recordFamilyUpdate: recordUpdate }));
import { IntroductionActionWorkspace } from "../src/app/brokerdesk/w/[workspaceRef]/introductions/[introductionRef]/introduction-action-workspace";
import { actionFixture, workspace, introduction, date } from "./introduction-workspace.fixture";
const source = () => within(screen.getByRole("region", { name: "Customer A sharing actions" }));
const recipient = () => within(screen.getByRole("region", { name: "Customer B sharing actions" }));

describe("broker Introduction actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAction.mockResolvedValue(actionFixture());
    record.mockResolvedValue({ available: true, side: "source", shareState: "initiated", rowVersion: 2 });
    activate.mockResolvedValue({ available: true, rowVersion: 3, status: "shared" });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vivintro.com");
  });
  it("copies a private URL and records only the chosen side as an attempt", async () => {
    const updated = actionFixture(); updated.sides[0].shareState = "initiated"; updated.sides[0].rowVersion = 2;
    getAction.mockResolvedValue(updated);
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={actionFixture()} />);
    fireEvent.click(source().getByRole("button", { name: "Copy link" }));
    await screen.findByText(/Link copied/);
    expect(record).toHaveBeenCalledExactlyOnceWith(workspace, introduction, expect.objectContaining({ side: "source", action: "initiate", expectedVersion: 1 }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`https://vivintro.com/introductions/${introduction}`);
    expect(source().getByText("Sharing started")).toBeVisible();
    expect(recipient().getByText("Not recorded yet")).toBeVisible();
    expect(screen.queryByText(/delivered successfully|message read/i)).not.toBeInTheDocument();
  });
  it("records a parent decision with explicit consent to the mutual disclosure", async () => {
    const initial = actionFixture();
    const side = initial.sides[0];
    Object.assign(side, { canRecordResponse: true });
    recordUpdate.mockResolvedValue({ available: true, rowVersion: 3, completeAccessExpiresAt: date });
    const updated = actionFixture();
    Object.assign(updated, { completeAccessExpiresAt: date });
    getAction.mockResolvedValue(updated);

    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={initial} />);
    fireEvent.click(source().getByText("Record a response or family update"));
    fireEvent.change(source().getByLabelText("Response"), { target: { value: "accepted" } });
    fireEvent.change(source().getByLabelText("Who responded?"), { target: { value: "authorized_parent" } });
    fireEvent.change(source().getByLabelText("How did they respond?"), { target: { value: "phone" } });
    expect(source().getByRole("checkbox", { name: /Protected Contact for 30 days/ })).toBeRequired();
    fireEvent.click(source().getByRole("checkbox"));
    fireEvent.click(source().getByRole("button", { name: "Save response" }));
    await waitFor(() => expect(recordUpdate).toHaveBeenCalledExactlyOnceWith(workspace, introduction, expect.objectContaining({
      side: "source", status: "accepted", reportedBy: "authorized_parent", channel: "phone", consentAttested: true,
    })));
    expect(record).not.toHaveBeenCalled();
  });
  it("activates an unshared Introduction before recording its side attempt", async () => {
    const initial = actionFixture(); initial.status = "created"; initial.canActivate = true;
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={initial} />);
    fireEvent.click(source().getByRole("button", { name: "Copy link" }));
    await screen.findByText(/Link copied/);
    expect(activate).toHaveBeenCalledWith(workspace, introduction, 2);
    expect(activate.mock.invocationCallOrder[0]).toBeLessThan(record.mock.invocationCallOrder[0]);
  });
  it("explains the activation handoff without granting coordinators sender authority", () => {
    const initial = actionFixture(); initial.status = "created"; initial.canActivate = false;
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={initial} />);
    expect(screen.getAllByText("Ask an authorized sender in your team to activate this Introduction first.")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled();
  });
  it("opens WhatsApp without claiming delivery, and clears the opener", async () => {
    const popup = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={actionFixture()} />);
    fireEvent.click(source().getByRole("button", { name: "Share on WhatsApp" }));
    await screen.findByText(/Choose the correct family conversation/);
    expect(popup.opener).toBeNull(); expect(popup.location.replace).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa.me\/\?text=/));
    expect(decodeURIComponent(popup.location.replace.mock.calls[0][0])).not.toContain("Customer A");
  });
  it("does not record an attempt when the popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={actionFixture()} />);
    fireEvent.click(source().getByRole("button", { name: "Share on WhatsApp" }));
    await screen.findByText(/Allow this WhatsApp window/); expect(record).not.toHaveBeenCalled();
  });
  it("records explicit broker confirmation separately from candidate interest", async () => {
    record.mockResolvedValue({ available: true, side: "source", shareState: "broker_confirmed", rowVersion: 2 });
    const updated = actionFixture(); updated.sides[0].shareState = "broker_confirmed"; updated.sides[0].confirmedAt = date;
    getAction.mockResolvedValue(updated);
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={actionFixture()} />);
    fireEvent.click(source().getByRole("button", { name: "I shared with this family" }));
    await screen.findByText("Your sharing confirmation was recorded.");
    expect(record).toHaveBeenCalledWith(workspace, introduction, expect.objectContaining({ action: "confirm" }));
    expect(source().getByText("Awaiting response")).toBeVisible();
    expect(source().getByText("Broker confirmed sharing")).toBeVisible();
    expect(source().getByRole("button", { name: "I shared with this family" })).toBeDisabled();
  });
  it("allows reminders only where the server permits and records the reminder action", async () => {
    const initial = actionFixture(); initial.sides[0].canRemind = true; initial.sides[0].shareState = "initiated";
    const popup = { opener: null, location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={initial} />);
    expect(recipient().getByRole("button", { name: "Remind on WhatsApp" })).toBeDisabled();
    fireEvent.click(source().getByRole("button", { name: "Remind on WhatsApp" }));
    await screen.findByText(/WhatsApp opened for your reminder/);
    expect(record).toHaveBeenCalledWith(workspace, introduction, expect.objectContaining({ action: "remind" }));
  });
  it("honestly reports a clipboard failure after a successful command and recovers by refresh", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error("clipboard"));
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={actionFixture()} />);
    fireEvent.click(source().getByRole("button", { name: "Copy link" }));
    await screen.findByText(/attempt was recorded, but the link/);
    expect(source().getByRole("button", { name: "Copy link" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh progress" }));
    await waitFor(() => expect(source().getByRole("button", { name: "Copy link" })).toBeEnabled());
  });
  it("closes the blank WhatsApp tab on command failure without claiming success", async () => {
    const popup = { opener: null, location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    record.mockRejectedValueOnce(new Error("Access changed"));
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={actionFixture()} />);
    fireEvent.click(source().getByRole("button", { name: "Share on WhatsApp" }));
    await screen.findByText("Access changed"); expect(popup.close).toHaveBeenCalledOnce(); expect(popup.location.replace).not.toHaveBeenCalled();
  });
  it("retains honest success when refreshing progress fails after sending control opens", async () => {
    getAction.mockRejectedValue(new Error("temporary"));
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={actionFixture()} />);
    fireEvent.click(source().getByRole("button", { name: "Copy link" }));
    await screen.findByText(/Refresh to see the latest progress/);
    fireEvent.click(screen.getByRole("button", { name: "Refresh progress" }));
    await screen.findByText("temporary");
  });
  it("shows read-only and controlled history without offering candidate responses", () => {
    const initial = actionFixture(); initial.sides.forEach(side => { side.canShare = false; });
    initial.timeline = [{ type: "share_confirmed", occurredAt: date, side: "recipient" }, { type: "mutual_access_granted", occurredAt: date, side: null }];
    render(<IntroductionActionWorkspace workspaceRef={workspace} initial={initial} />);
    expect(screen.getByText("Broker confirmed sharing · Customer B")).toBeVisible();
    expect(screen.getAllByText(/Sharing is unavailable/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^Interested$|^Decline$/ })).not.toBeInTheDocument();
  });
});
