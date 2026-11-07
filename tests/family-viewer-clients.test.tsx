// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
const proposeFamilyViewer = vi.hoisted(() => vi.fn());
const createFamilyViewer = vi.hoisted(() => vi.fn());
const decideFamilyViewerProposal = vi.hoisted(() => vi.fn());
const setPrimaryFamilyViewer = vi.hoisted(() => vi.fn());
const revokeFamilyViewer = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/family-viewers/client/family-viewer.api", () => ({
  proposeFamilyViewer,
  createFamilyViewer,
  decideFamilyViewerProposal,
  setPrimaryFamilyViewer,
  revokeFamilyViewer,
}));

import { FamilyViewerManager } from "@/app/brokers/family-viewer-manager";
import { FamilyViewerPanel } from "@/app/brokerdesk/w/[workspaceRef]/customers/[relationshipRef]/family-viewer-panel";
import { FamilyInvitationClient } from "@/app/join/family/family-invitation-client";
import { candidateFamilyRosterSchema } from "@/features/family-viewers/server/family-viewer.contract";

const viewerRef = `fvw_${"a".repeat(32)}`;
const activeRef = `fvw_${"b".repeat(32)}`;

describe("Family Viewer clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });

  it("lets the broker propose without granting family access", async () => {
    proposeFamilyViewer.mockResolvedValue({ accepted: true });
    render(<FamilyViewerPanel
      workspaceRef={`wrk_${"c".repeat(32)}`}
      relationshipRef={`bcr_${"d".repeat(32)}`}
      setup={{
        available: true,
        activeViewerCount: 1,
        maximumActiveViewers: 3,
        canPropose: true,
        ownProposals: [{
          displayName: "Lakshmi",
          relationshipKind: "mother",
          relationshipLabel: null,
          emailHint: "la***@example.com",
          preferredLocale: null,
          status: "pending_candidate_approval",
          createdAt: "2026-10-23T12:00:00Z",
        }],
      }}
    />);
    await userEvent.type(screen.getByLabelText("Family member name"), "Ravi");
    await userEvent.type(screen.getByLabelText("Email used for Google sign-in"), "ravi@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Relationship"), "father");
    await userEvent.click(screen.getByRole("button", { name: /suggest family representative/i }));
    await waitFor(() => expect(proposeFamilyViewer).toHaveBeenCalledWith(
      expect.stringMatching(/^wrk_/),
      expect.stringMatching(/^bcr_/),
      expect.objectContaining({ email: "ravi@example.com", relationshipKind: "father" })
    ));
    expect(screen.getByRole("status")).toHaveTextContent(/customer manages family invitations and must approve/i);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText("Lakshmi")).not.toBeInTheDocument();
    expect(screen.getByText(/proposal details are not displayed/i)).toBeVisible();
  });

  it("supports candidate invite, proposal approval, primary selection and revocation", async () => {
    createFamilyViewer.mockResolvedValue({
      available: true,
      invitationUrl: `https://vivintro.test/join/family#token=${"x".repeat(43)}`,
      emailStatus: "unavailable",
    });
    decideFamilyViewerProposal.mockResolvedValue({
      available: true,
      invitationUrl: `https://vivintro.test/join/family#token=${"y".repeat(43)}`,
      emailStatus: "sent",
    });
    setPrimaryFamilyViewer.mockResolvedValue({ available: true });
    revokeFamilyViewer.mockResolvedValue({ available: true });
    const roster = candidateFamilyRosterSchema.parse({
      available: true as const,
      activeCount: 1,
      viewers: [
        {
          viewerRef,
          displayName: "Lakshmi",
          relationshipKind: "mother" as const,
          relationshipLabel: null,
          emailHint: "la***@example.com",
          preferredLocale: null,
          role: "viewer" as const,
          status: "pending_candidate_approval" as const,
          rowVersion: 1,
          proposedByWorkspaceName: "Trusted Matrimony",
          invitationStatus: null,
          invitationExpiresAt: null,
        },
        {
          viewerRef: activeRef,
          displayName: "Ravi",
          relationshipKind: "father" as const,
          relationshipLabel: null,
          emailHint: "ra***@example.com",
          preferredLocale: null,
          role: "viewer" as const,
          status: "active" as const,
          rowVersion: 2,
          proposedByWorkspaceName: null,
          invitationStatus: "accepted" as const,
          invitationExpiresAt: null,
        },
      ],
    });
    if (!roster.available) throw new Error("expected available roster fixture");
    render(<FamilyViewerManager roster={roster} />);

    await userEvent.type(screen.getByLabelText("Name"), "Anita");
    await userEvent.type(screen.getByLabelText("Google email"), "anita@example.com");
    await userEvent.click(screen.getByRole("button", { name: /invite family representative/i }));
    await waitFor(() => expect(createFamilyViewer).toHaveBeenCalledWith(expect.objectContaining({
      email: "anita@example.com",
      relationshipKind: "parent",
    })));
    expect(screen.getByRole("status")).toHaveTextContent(/email delivery is unavailable/i);
    expect(screen.getByRole("link", { name: /share on whatsapp/i })).toHaveAttribute("href", expect.stringContaining("wa.me"));

    await userEvent.type(screen.getByLabelText(/re-enter the exact email/i), "lakshmi@example.com");
    await userEvent.click(screen.getByRole("button", { name: /approve and invite/i }));
    await waitFor(() => expect(decideFamilyViewerProposal).toHaveBeenCalledWith(viewerRef, expect.objectContaining({
      decision: "approve",
      email: "lakshmi@example.com",
    })));

    await userEvent.click(screen.getByRole("button", { name: /make primary/i }));
    await waitFor(() => expect(setPrimaryFamilyViewer).toHaveBeenCalledWith(activeRef, 2));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(revokeFamilyViewer).toHaveBeenCalledWith(activeRef, 2));
  });

  it("requires a local capability before review and preserves Google-only continuation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ready: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ available: false }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", `/join/family#token=${"z".repeat(43)}`);
    render(<FamilyInvitationClient />);
    expect(await screen.findByRole("heading", { name: /support your family member/i })).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /accept family access/i }));
    expect(await screen.findByRole("heading", { name: /sign in with google/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /sign in securely/i })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fjoin%2Ffamily&method=google"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/family-invitations/exchange", expect.any(Object));
  });

  it("keeps a direct family setup visit unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ready: false }), { status: 200 })
    ));
    window.history.replaceState(null, "", "/join/family");
    render(<FamilyInvitationClient />);
    expect(await screen.findByRole("heading", { name: /ask the candidate for a new invitation/i })).toBeVisible();
  });
});
