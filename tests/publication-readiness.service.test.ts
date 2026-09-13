import { describe, expect, it, vi } from "vitest";
import {
  getPublicationReadiness,
  updatePublicationProgress,
} from "@/features/portfolio/server/publication-readiness.service";

const readiness = {
  portfolioExists: true,
  lastEditorSection: "astrology",
  previewedAt: "2026-09-13T12:00:00.000Z",
  selectedPlanCode: "launch_30",
  verificationStatus: "verified",
  paymentStatus: "paid",
  paymentExpiresAt: "2026-10-13T12:00:00.000Z",
  paymentActive: true,
  disclosureConfirmed: false,
  published: false,
  missingRequired: [],
};

describe("publication readiness service", () => {
  it("returns a validated owner-safe readiness projection", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: readiness, error: null });
    await expect(getPublicationReadiness({ rpc } as never)).resolves.toEqual(readiness);
    expect(rpc).toHaveBeenCalledWith("get_portfolio_publication_readiness");
  });

  it("persists a typed transition and returns the resulting projection", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "ok", readiness },
      error: null,
    });
    await expect(updatePublicationProgress(
      { rpc } as never,
      { action: "editor_section", value: "astrology" }
    )).resolves.toEqual(readiness);
    expect(rpc).toHaveBeenCalledWith("update_portfolio_onboarding_progress", {
      p_action: "editor_section",
      p_value: "astrology",
    });
  });

  it.each([
    ["not_found", "PORTFOLIO_DRAFT_MISSING"],
    ["verification_required", "IDENTITY_VERIFICATION_REQUIRED"],
    ["payment_required", "PAYMENT_REQUIRED"],
    ["content_required", "PORTFOLIO_NOT_READY"],
  ])("maps %s without exposing database details", async (status, code) => {
    const rpc = vi.fn().mockResolvedValue({ data: { status }, error: null });
    await expect(updatePublicationProgress(
      { rpc } as never,
      { action: "confirm_disclosure", value: "publication-disclosure-v1" }
    )).rejects.toMatchObject({ code });
  });
});
