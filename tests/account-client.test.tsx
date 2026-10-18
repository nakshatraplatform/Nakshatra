// @vitest-environment jsdom

import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const mocks = vi.hoisted(() => ({
  export: vi.fn(),
  sessions: vi.fn(),
  deletion: vi.fn(),
  cancel: vi.fn(),
  reauth: vi.fn(),
  profile: vi.fn(),
}));

vi.mock("@/features/account/client/account.api", () => ({
  downloadAccountExportRequest: mocks.export,
  revokeOtherSessionsRequest: mocks.sessions,
  requestAccountDeletionRequest: mocks.deletion,
  cancelAccountDeletionRequest: mocks.cancel,
  startAccountDeletionReauthRequest: mocks.reauth,
  saveAccountProfileRequest: mocks.profile,
}));

import AccountClient from "../src/app/account/account-client";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.export.mockResolvedValue({ ok: true, data: new Blob(["{}"], { type: "application/json" }) });
  mocks.sessions.mockResolvedValue({ ok: true, data: { ok: true } });
  mocks.deletion.mockResolvedValue({
    ok: true,
    data: { status: "pending", scheduledFor: "2026-08-18T00:00:00Z" },
  });
  mocks.cancel.mockResolvedValue({ ok: true, data: { ok: true } });
  mocks.reauth.mockResolvedValue({ ok: true, data: { sent: true } });
  URL.createObjectURL = vi.fn(() => "blob:account-export");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("account privacy screen", () => {
  it("keeps deletion loading feedback inside the confirmation dialog", async () => {
    let resolve!: (value: { ok: false; error: { message: string; code: string; status: number } }) => void;
    mocks.deletion.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<AccountClient userEmail="owner@example.test" initialDeletion={null} reauthComplete />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/type delete/i), { target: { value: "DELETE" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule deletion" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Scheduling account deletion");
    await act(async () => resolve({ ok: false, error: { message: "Please retry", code: "UNAVAILABLE", status: 503 } }));
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Schedule deletion" })).toBeEnabled();
  });

  it("shows saved introduction names as read-only with one clear editing route", () => {
    render(<AccountClient userEmail="owner@example.test" initialDeletion={null} profileManagedByPortfolio
      initialProfile={{ firstName: "Mary Jane", middleName: "Anne", lastName: "Rao" }} />);
    expect(screen.getByLabelText("First name")).toHaveValue("Mary Jane");
    expect(screen.getByLabelText("First name")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Middle name (optional)")).toHaveValue("Anne");
    expect(screen.getByLabelText("Last name")).toHaveValue("Rao");
    expect(screen.queryByRole("button", { name: "Save names" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit introduction names" })).toHaveAttribute("href", "/dashboard?edit=1");
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("saves separate account names with an optional middle name and shows linked methods", async () => {
    const profile = { firstName: "Rahul", middleName: "", lastName: "Ranganatha" };
    mocks.profile.mockResolvedValue({ ok: true, data: profile });
    render(<AccountClient userEmail="owner@example.test" initialDeletion={null} signInMethods={["Google"]} />);
    expect(screen.getByLabelText("Middle name (optional)")).not.toBeRequired();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: profile.firstName } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: profile.lastName } });
    fireEvent.click(screen.getByRole("button", { name: "Save names" }));
    await waitFor(() => expect(mocks.profile).toHaveBeenCalledWith(profile));
    expect(await screen.findByText("Your account names have been saved. Your portfolio has not changed.")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.queryByText("Payment method")).not.toBeInTheDocument();
  });
  it("hides the JSON download until a portfolio PDF is available and still revokes other sessions", async () => {
    render(<AccountClient userEmail="owner@example.test" initialDeletion={null} reauthComplete />);
    expect(screen.getByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your devices" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Close your account" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Download your data" })).not.toBeInTheDocument();
    expect(mocks.export).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign out others" }));
    await waitFor(() => expect(mocks.sessions).toHaveBeenCalled());
    expect(screen.getByText("Other devices have been signed out.")).toBeInTheDocument();
  });

  it("requires typed confirmation before scheduling deletion", async () => {
    render(<AccountClient userEmail="owner@example.test" initialDeletion={null} reauthComplete />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    const schedule = screen.getByRole("button", { name: "Schedule deletion" });
    expect(schedule).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type delete/i), { target: { value: "DELETE" } });
    fireEvent.click(schedule);

    await waitFor(() => expect(mocks.deletion).toHaveBeenCalled());
    expect(screen.getByText(/Account deletion is scheduled/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel deletion" })).toBeInTheDocument();
  });

  it("starts a fresh email sign-in before enabling deletion", async () => {
    render(<AccountClient userEmail="owner@example.test" initialDeletion={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const schedule = screen.getByRole("button", { name: "Schedule deletion" });
    expect(schedule).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /email link/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to fresh sign-in" }));

    await waitFor(() => expect(mocks.reauth).toHaveBeenCalledWith("email"));
    expect(await screen.findByText(/secure sign-in link was sent/i)).toBeInTheDocument();
    expect(schedule).toBeDisabled();
    expect(mocks.deletion).not.toHaveBeenCalled();
  });

  it("closes confirmation without deleting and explains ownership transfer blocks", async () => {
    mocks.deletion.mockResolvedValueOnce({
      ok: true,
      data: { status: "ownership_transfer_required", organizationCount: 2 },
    });
    render(<AccountClient userEmail="owner@example.test" initialDeletion={null} reauthComplete />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.click(screen.getByRole("button", { name: "Close deletion confirmation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText(/type delete/i), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule deletion" }));
    expect(await screen.findByText(/Transfer ownership of 2 organizations/)).toBeInTheDocument();
  });

  it("shows a pending request and lets the user cancel it", async () => {
    render(<AccountClient
      userEmail="owner@example.test"
      initialDeletion={{
        status: "pending",
        scheduledFor: "2026-08-18T00:00:00Z",
        requestedAt: "2026-08-17T00:00:00Z",
      }}
    />);
    expect(screen.getByText(/Public and approved portfolio access is already disabled/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalled());
    expect(screen.getByText(/Account deletion has been canceled/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  it("renders processing as a non-actionable account lock", () => {
    render(<AccountClient
      userEmail="owner@example.test"
      initialDeletion={{
        status: "processing",
        scheduledFor: "2026-08-18T00:00:00Z",
        requestedAt: "2026-08-17T00:00:00Z",
      }}
    />);
    expect(screen.getByText(/Deletion is being processed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
  });

  it("surfaces safe API errors for every action", async () => {
    const failure = { ok: false, code: "UNAVAILABLE", message: "Please try again.", status: 503 };
    mocks.sessions.mockResolvedValueOnce(failure);
    mocks.cancel.mockResolvedValueOnce(failure);
    const first = render(<AccountClient userEmail="owner@example.test" initialDeletion={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out others" }));
    await waitFor(() => expect(mocks.sessions).toHaveBeenCalled());
    expect(await screen.findByText("Please try again.")).toBeInTheDocument();

    first.unmount();
    render(<AccountClient
      userEmail="owner@example.test"
      initialDeletion={{
        status: "failed",
        scheduledFor: "2026-08-18T00:00:00Z",
        requestedAt: "2026-08-17T00:00:00Z",
      }}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalled());
    expect(screen.getByText("Please try again.")).toBeInTheDocument();
  });
});
