// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerInvitationClient } from "../src/app/join/customer/customer-invitation-client";
import CustomerInvitationPage from "../src/app/join/customer/page";

describe("BrokerDesk customer invitation client", () => {
  beforeEach(() => history.replaceState(null, "", "/join/customer"));

  it("removes the fragment and waits for explicit customer consent before claiming", async () => {
    const token = "a".repeat(43);
    history.replaceState(null, "", `/join/customer#token=${token}`);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ready: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        available: true,
        status: "active",
        invitationRef: `inv_${"b".repeat(32)}`,
        workspaceName: "Agency A",
        relationshipRef: `bcr_${"c".repeat(32)}`,
        relationshipEndsAt: "2027-09-10T00:00:00Z",
      }), { status: 200 }));
    render(<CustomerInvitationClient />);
    expect(await screen.findByRole("heading", { name: "Connect your portfolio to this broker" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    const accept = screen.getByRole("button", { name: "Accept and continue" });
    expect(accept).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /authorize this broker relationship/i }));
    await userEvent.click(accept);
    expect(await screen.findByRole("heading", { name: "You are connected to Agency A" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/customer/broker-invitations/claim", expect.objectContaining({
      body: JSON.stringify({ consent: true, consentVersion: "broker-representation-v2" }),
    }));
  });

  it("continues the same invitation through sign-in and canonical portfolio completion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 401 }));
    render(<CustomerInvitationClient />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /authorize this broker relationship/i }));
    await userEvent.click(screen.getByRole("button", { name: "Accept and continue" }));
    expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in securely" })).toHaveAttribute("href", "/login?next=/join/customer");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      available: true,
      status: "portfolio_required",
      invitationRef: `inv_${"b".repeat(32)}`,
      workspaceName: "Agency A",
      relationshipRef: null,
      relationshipEndsAt: "2027-09-10T00:00:00Z",
    }), { status: 200 }));
    history.replaceState(null, "", "/join/customer");
    const { unmount } = render(<CustomerInvitationClient />);
    await userEvent.click(await screen.findAllByRole("checkbox", { name: /authorize this broker relationship/i }).then((items) => items.at(-1)!));
    await userEvent.click(await screen.findAllByRole("button", { name: "Accept and continue" }).then((buttons) => buttons.at(-1)!));
    expect(await screen.findByRole("heading", { name: "Complete your one VivIntro portfolio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Complete my portfolio" })).toHaveAttribute("href", "/dashboard");
    unmount();
  });

  it("keeps unavailable invitations neutral", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    history.replaceState(null, "", `/join/customer#token=${"a".repeat(43)}`);
    render(<CustomerInvitationClient />);
    expect(await screen.findByRole("heading", { name: "Ask your broker for a new link" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("uses the customer invitation client as the public-shell page", async () => {
    render(<CustomerInvitationPage />);
    expect(await screen.findByRole("heading", { name: "Connect your portfolio to this broker" })).toBeInTheDocument();
  });
});
