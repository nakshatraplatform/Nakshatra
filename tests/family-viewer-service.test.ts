import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  resolveBrokerdeskSetup: vi.fn(),
  propose: vi.fn(),
  resolveCandidateRoster: vi.fn(),
  create: vi.fn(),
  decide: vi.fn(),
  setPrimary: vi.fn(),
  revoke: vi.fn(),
  accept: vi.fn(),
}));

vi.mock("@/features/family-viewers/server/family-viewer.repository", () => ({
  FamilyViewerRepository: class {
    resolveBrokerdeskSetup = repository.resolveBrokerdeskSetup;
    propose = repository.propose;
    resolveCandidateRoster = repository.resolveCandidateRoster;
    create = repository.create;
    decide = repository.decide;
    setPrimary = repository.setPrimary;
    revoke = repository.revoke;
    accept = repository.accept;
  },
}));

import {
  acceptFamilyViewerInvitation,
  createCandidateFamilyViewer,
  decideCandidateFamilyViewerProposal,
  proposeFamilyViewer,
  resolveBrokerdeskFamilySetup,
  resolveCandidateFamilyRoster,
  revokeCandidateFamilyViewer,
  setCandidatePrimaryFamilyViewer,
} from "@/features/family-viewers/server/family-viewer.service";
import {
  candidateFamilyViewerCreateResponseSchema,
  candidateFamilyViewerDecisionResponseSchema,
  createFamilyViewerCommandSchema,
  decideFamilyViewerProposalCommandSchema,
  proposeFamilyViewerCommandSchema,
} from "@/features/family-viewers/server/family-viewer.contract";

const supabase = {} as never;
const workspaceRef = `wrk_${"a".repeat(32)}`;
const relationshipRef = `bcr_${"b".repeat(32)}`;
const viewerRef = `fvw_${"c".repeat(32)}`;
const invitationRef = `fvi_${"d".repeat(32)}`;

describe("Family Viewer service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates broker references and parses bounded broker results", async () => {
    await expect(resolveBrokerdeskFamilySetup(supabase, "unsafe", relationshipRef))
      .resolves.toEqual({ available: false });
    repository.resolveBrokerdeskSetup.mockResolvedValue({
      data: { available: true, activeViewerCount: 0, maximumActiveViewers: 3, canPropose: true, ownProposals: [] },
      error: null,
    });
    await expect(resolveBrokerdeskFamilySetup(supabase, workspaceRef, relationshipRef))
      .resolves.toMatchObject({ available: true, maximumActiveViewers: 3 });

    repository.resolveBrokerdeskSetup.mockResolvedValueOnce({
      data: { available: true, activeViewerCount: 0, maximumActiveViewers: 3, canPropose: true,
        ownProposals: [{ displayName: "Private parent", relationshipKind: "parent", relationshipLabel: null,
          emailHint: "pa***@example.com", preferredLocale: null, status: "pending_candidate_approval", createdAt: "2026-11-05T12:00:00Z" }] },
      error: null,
    });
    await expect(resolveBrokerdeskFamilySetup(supabase, workspaceRef, relationshipRef))
      .rejects.toMatchObject({ code: "BROKERDESK_FAMILY_SETUP_UNAVAILABLE" });

    repository.propose.mockResolvedValue({ data: { accepted: true }, error: null });
    await expect(proposeFamilyViewer(supabase, {
      workspaceRef,
      relationshipRef,
      emailHash: "a".repeat(64),
      emailHint: "pa***@example.com",
      displayName: "Parent",
      relationshipKind: "parent",
      relationshipLabel: null,
      preferredLocale: null,
      idempotencyKey: "family-proposal:0001",
    })).resolves.toEqual({ accepted: true });
  });

  it("runs candidate roster and command transitions through strict schemas", async () => {
    repository.resolveCandidateRoster.mockResolvedValue({
      data: { available: true, activeCount: 0, viewers: [] }, error: null,
    });
    await expect(resolveCandidateFamilyRoster(supabase)).resolves.toMatchObject({ available: true });

    repository.create.mockResolvedValue({ data: {
      available: true,
      viewerRef,
      invitationRef,
      status: "pending_verification",
      expiresAt: "2026-10-30T12:00:00Z",
      rowVersion: 1,
    }, error: null });
    await expect(createCandidateFamilyViewer(supabase, {
      emailHash: "a".repeat(64), emailHint: "pa***@example.com", displayName: "Parent",
      relationshipKind: "parent", relationshipLabel: null, preferredLocale: null,
      tokenHash: "b".repeat(64), idempotencyKey: "family-create:0001",
    })).resolves.toMatchObject({ viewerRef, invitationRef });

    repository.decide.mockResolvedValue({ data: {
      available: true, viewerRef, status: "rejected", rowVersion: 2,
    }, error: null });
    await expect(decideCandidateFamilyViewerProposal(supabase, {
      viewerRef, decision: "reject", emailHash: null, tokenHash: null, idempotencyKey: "decision:0001",
    })).resolves.toMatchObject({ status: "rejected" });

    const active = { available: true, viewerRef, status: "active", role: "primary", rowVersion: 3 };
    repository.setPrimary.mockResolvedValue({ data: active, error: null });
    repository.revoke.mockResolvedValue({ data: { ...active, status: "revoked" }, error: null });
    repository.accept.mockResolvedValue({ data: active, error: null });
    await expect(setCandidatePrimaryFamilyViewer(supabase, { viewerRef, expectedVersion: 2, idempotencyKey: "primary:0001" }))
      .resolves.toMatchObject({ role: "primary" });
    await expect(revokeCandidateFamilyViewer(supabase, { viewerRef, expectedVersion: 3, idempotencyKey: "revoke:0001" }))
      .resolves.toMatchObject({ status: "revoked" });
    await expect(acceptFamilyViewerInvitation(supabase, "a".repeat(64), "accept:0001"))
      .resolves.toMatchObject({ status: "active" });
  });

  it("maps invalid command data and repository failures to safe errors", async () => {
    await expect(decideCandidateFamilyViewerProposal(supabase, {
      viewerRef: "unsafe", decision: "reject", emailHash: null, tokenHash: null, idempotencyKey: "decision:error",
    })).resolves.toEqual({ available: false });
    repository.create.mockResolvedValue({ data: null, error: { code: "22023" } });
    await expect(createCandidateFamilyViewer(supabase, {
      emailHash: "a".repeat(64), emailHint: "pa***@example.com", displayName: "Parent",
      relationshipKind: "parent", relationshipLabel: null, preferredLocale: null,
      tokenHash: "b".repeat(64), idempotencyKey: "family-create:error",
    })).rejects.toMatchObject({ status: 400, code: "CUSTOMER_FAMILY_VIEWER_INVALID" });
  });

  it("fails safely across invalid broker scopes and repository output", async () => {
    await expect(resolveBrokerdeskFamilySetup(supabase, workspaceRef, "unsafe"))
      .resolves.toEqual({ available: false });
    await expect(proposeFamilyViewer(supabase, {
      workspaceRef: "unsafe", relationshipRef, emailHash: "a".repeat(64), emailHint: "pa***@example.com",
      displayName: "Parent", relationshipKind: "parent", relationshipLabel: null,
      preferredLocale: null, idempotencyKey: "proposal:invalid-ref",
    })).rejects.toMatchObject({ status: 404 });

    repository.resolveBrokerdeskSetup.mockResolvedValue({ data: null, error: { code: "db" } });
    await expect(resolveBrokerdeskFamilySetup(supabase, workspaceRef, relationshipRef))
      .rejects.toMatchObject({ code: "BROKERDESK_FAMILY_SETUP_UNAVAILABLE" });
    repository.resolveCandidateRoster.mockResolvedValue({ data: null, error: null });
    await expect(resolveCandidateFamilyRoster(supabase))
      .rejects.toMatchObject({ code: "CUSTOMER_FAMILY_VIEWERS_UNAVAILABLE" });

    repository.propose.mockResolvedValue({ data: null, error: { code: "22023" } });
    await expect(proposeFamilyViewer(supabase, {
      workspaceRef, relationshipRef, emailHash: "a".repeat(64), emailHint: "pa***@example.com",
      displayName: "Parent", relationshipKind: "parent", relationshipLabel: null,
      preferredLocale: null, idempotencyKey: "proposal:invalid",
    })).rejects.toMatchObject({ status: 400 });

    repository.accept.mockResolvedValue({ data: null, error: { code: "db" } });
    await expect(acceptFamilyViewerInvitation(supabase, "a".repeat(64), "accept:error"))
      .rejects.toMatchObject({ status: 503, code: "CUSTOMER_FAMILY_VIEWER_UNAVAILABLE" });
    await expect(setCandidatePrimaryFamilyViewer(supabase, {
      viewerRef: "unsafe", expectedVersion: 1, idempotencyKey: "primary:invalid",
    })).resolves.toEqual({ available: false });
    await expect(revokeCandidateFamilyViewer(supabase, {
      viewerRef: "unsafe", expectedVersion: 1, idempotencyKey: "revoke:invalid",
    })).resolves.toEqual({ available: false });
  });

  it("keeps command and transport schema branches explicit", () => {
    const base = {
      email: "parent@example.com",
      displayName: "Parent",
      preferredLocale: null,
      idempotencyKey: "family-schema:0001",
    };
    expect(proposeFamilyViewerCommandSchema.safeParse({
      ...base, relationshipKind: "other", relationshipLabel: null,
    }).success).toBe(false);
    expect(createFamilyViewerCommandSchema.safeParse({
      ...base, relationshipKind: "parent", relationshipLabel: "Unneeded",
    }).success).toBe(false);
    expect(decideFamilyViewerProposalCommandSchema.safeParse({
      decision: "approve", email: "parent@example.com", idempotencyKey: "family-decision:approve-0001",
    }).success).toBe(true);
    expect(decideFamilyViewerProposalCommandSchema.safeParse({
      decision: "reject", idempotencyKey: "family-decision:reject-0001",
    }).success).toBe(true);
    expect(candidateFamilyViewerCreateResponseSchema.safeParse({ available: false }).success).toBe(true);
    expect(candidateFamilyViewerDecisionResponseSchema.safeParse({
      available: true, viewerRef, status: "rejected", rowVersion: 2,
    }).success).toBe(true);
  });
});
