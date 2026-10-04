// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PilotAccessAdminClient from "../src/app/admin/pilot-access/pilot-access-admin-client";

const request = {
  requestRef: `par_${"a".repeat(32)}`,
  displayName: "Aditi Rao",
  verifiedEmail: "aditi@example.com",
  phoneE164: "+14155550100",
  status: "pending",
  submittedAt: "2026-09-12T12:00:00Z",
  reviewedAt: null,
  reviewNote: null,
};

describe("pilot access administrator experience", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  it("lists verified waitlist entries without creator approval controls", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("creator-invitations") ? { invitations: [] } : { requests: [request] }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    expect(document.querySelector("main")).toHaveClass("pilot-access-shell");
    expect(await screen.findByText("aditi@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/pilot-access?status=pending", { cache: "no-store" });
  });

  it("shows a safe error when the queue cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Pilot administration is unavailable." }), { status: 403 })));
    render(<PilotAccessAdminClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Pilot administration is unavailable.");
  });

  it("shows an empty waitlist and lets the administrator refresh it", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("creator-invitations") ? { invitations: [] } : { requests: [] }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    expect(await screen.findByRole("heading", { name: "No waitlist entries yet" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh waitlist" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });

  it("invites a creator and explains that provider acceptance is not signup", async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => Promise.resolve(new Response(JSON.stringify(
      options?.method === "POST" ? { delivery: "accepted" }
        : url.includes("creator-invitations") ? { invitations: [] } : { requests: [] },
    ), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    await screen.findByRole("heading", { name: "No waitlist entries yet" });
    await userEvent.type(screen.getByLabelText("Email address"), "person@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Add and email invitation" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Invitation created for person@gmail.com");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/creator-invitations", expect.objectContaining({
      method: "POST", body: JSON.stringify({ email: "person@gmail.com", action: "grant" }),
    }));
  });

  it("surfaces a private recovery link when invitation email is not accepted", async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => Promise.resolve(new Response(JSON.stringify(
      options?.method === "POST" ? { delivery: "failed", invitationUrl: "https://vivintro.com/invite/opaque", error: "Email not accepted" }
        : url.includes("creator-invitations") ? { invitations: [] } : { requests: [] },
    ), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    await screen.findByRole("heading", { name: "No waitlist entries yet" });
    await userEvent.type(screen.getByLabelText("Email address"), "person@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Add and email invitation" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Email not accepted");
    const privateLink = screen.getByDisplayValue("https://vivintro.com/invite/opaque") as HTMLInputElement;
    await userEvent.click(privateLink);
    expect(privateLink.selectionStart).toBe(0);
    expect(privateLink.selectionEnd).toBe(privateLink.value.length);
  });

  it("can revoke an active creator invitation", async () => {
    const invitation = { email: "person@gmail.com", invited_at: "2026-10-03T00:00:00Z", expires_at: "2099-10-10T00:00:00Z", accepted_at: null, revoked_at: null };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => Promise.resolve(new Response(JSON.stringify(
      options?.method === "POST" ? { delivery: "not_applicable" }
        : url.includes("creator-invitations") ? { invitations: [invitation] } : { requests: [] },
    ), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    await screen.findByText("person@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(await screen.findByRole("status")).toHaveTextContent("were revoked");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/creator-invitations", expect.objectContaining({
      method: "POST", body: JSON.stringify({ email: "person@gmail.com", action: "revoke" }),
    }));
  });

  it("keeps the form usable after the invitation API rejects a request", async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => Promise.resolve(new Response(JSON.stringify(
      options?.method === "POST" ? { error: "Administrator access is required." }
        : url.includes("creator-invitations") ? { invitations: [] } : { requests: [] },
    ), { status: options?.method === "POST" ? 403 : 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    await screen.findByRole("heading", { name: "No waitlist entries yet" });
    await userEvent.type(screen.getByLabelText("Email address"), "person@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Add and email invitation" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Administrator access is required.");
    expect(screen.getByRole("button", { name: "Add and email invitation" })).toBeEnabled();
    expect(screen.getByLabelText("Email address")).toHaveValue("person@gmail.com");
  });

  it("shows an actionable error if the invitation list fails while the waitlist loads", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url.includes("creator-invitations") ? { error: "Invitations unavailable." } : { requests: [] },
    ), { status: url.includes("creator-invitations") ? 503 : 200 }))));
    render(<PilotAccessAdminClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Invitations unavailable.");
    expect(screen.getByRole("button", { name: "Refresh waitlist" })).toBeEnabled();
  });

  it("reinvites expired addresses rather than trying to revoke them", async () => {
    const invitation = { email: "expired@gmail.com", invited_at: "2026-09-01T00:00:00Z", expires_at: "2026-09-08T00:00:00Z", accepted_at: null, revoked_at: null };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => Promise.resolve(new Response(JSON.stringify(
      options?.method === "POST" ? { delivery: "accepted" }
        : url.includes("creator-invitations") ? { invitations: [invitation] } : { requests: [] },
    ), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    await screen.findByText("expired@gmail.com");
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reinvite" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Invitation created for expired@gmail.com");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/creator-invitations", expect.objectContaining({
      body: JSON.stringify({ email: "expired@gmail.com", action: "grant" }),
    }));
  });

  it("handles a non-JSON invitation failure without losing the form", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST"
        ? new Response("service unavailable", { status: 503 })
        : new Response(JSON.stringify(url.includes("creator-invitations") ? { invitations: [] } : { requests: [] }), { status: 200 }),
    )));
    render(<PilotAccessAdminClient />);
    await screen.findByRole("heading", { name: "No waitlist entries yet" });
    await userEvent.type(screen.getByLabelText("Email address"), "person@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Add and email invitation" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Could not update this invitation.");
    expect(screen.getByRole("button", { name: "Add and email invitation" })).toBeEnabled();
  });
});
