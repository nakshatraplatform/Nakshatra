import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFamilyViewer,
  decideFamilyViewerProposal,
  proposeFamilyViewer,
  revokeFamilyViewer,
  setPrimaryFamilyViewer,
} from "@/features/family-viewers/client/family-viewer.api";

describe("Family Viewer client API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses encoded opaque references and allowlisted command bodies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ accepted: true, available: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })));
    const proposal = {
      email: "parent@example.com",
      displayName: "Parent",
      relationshipKind: "parent",
      relationshipLabel: null,
      preferredLocale: null,
      idempotencyKey: "family-proposal:0001",
    };
    await proposeFamilyViewer("wrk/safe", "bcr/safe", proposal);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/brokerdesk/workspaces/wrk%2Fsafe/customers/bcr%2Fsafe/family-proposals",
      expect.objectContaining({ method: "POST", body: JSON.stringify(proposal) })
    );

    await createFamilyViewer({ ...proposal, idempotencyKey: "family-create:0001" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/customer/family-viewers", expect.objectContaining({ method: "POST" }));
  });

  it("routes proposal decisions and versioned membership changes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ available: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })));
    await decideFamilyViewerProposal("fvw/safe", {
      decision: "reject",
      idempotencyKey: "family-decision:0001",
    });
    await setPrimaryFamilyViewer("fvw/safe", 4);
    await revokeFamilyViewer("fvw/safe", 5);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/customer/family-viewers/fvw%2Fsafe/decision",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/customer/family-viewers/fvw%2Fsafe/primary",
      expect.objectContaining({ body: expect.stringContaining('"expectedVersion":4') })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/customer/family-viewers/fvw%2Fsafe",
      expect.objectContaining({ method: "DELETE", body: expect.stringContaining('"expectedVersion":5') })
    );
  });

  it("uses safe server errors and neutral malformed-response fallbacks", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "The candidate must approve this request." }), { status: 403 }))
      .mockResolvedValueOnce(new Response("not json", { status: 503 }));
    await expect(proposeFamilyViewer("workspace", "relationship", {
      email: "parent@example.com",
      displayName: "Parent",
      relationshipKind: "parent",
      relationshipLabel: null,
      preferredLocale: null,
      idempotencyKey: "proposal:error",
    })).rejects.toThrow("The candidate must approve this request.");
    await expect(revokeFamilyViewer("viewer", 1))
      .rejects.toThrow("The family representative change could not be saved.");
  });
});
