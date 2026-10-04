import { describe, expect, it, vi } from "vitest";
import {
  getPublicationReadiness,
  updatePublicationProgress,
} from "@/features/portfolio/server/publication-readiness.service";
import { canPublishWithVerificationStatus, publicationReadinessSchema } from "@/features/portfolio/server/publication-readiness.contract";

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
  it("separates the named test publishing exception from real identity verification", () => {
    expect(publicationReadinessSchema.parse({ ...readiness, verificationStatus: "test_exempt" }).verificationStatus).toBe("test_exempt");
    expect(canPublishWithVerificationStatus("test_exempt")).toBe(true);
    expect(canPublishWithVerificationStatus("verified")).toBe(true);
    expect(canPublishWithVerificationStatus("required")).toBe(false);
  });
  it("normalizes omitted optional readiness fields", () => {
    expect(publicationReadinessSchema.parse({
      ...readiness,
      lastEditorSection: undefined,
      paymentActive: undefined,
    })).toMatchObject({ lastEditorSection: null, paymentActive: false });
  });

  it("returns a validated owner-safe readiness projection", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: readiness, error: null });
    await expect(getPublicationReadiness({ rpc } as never)).resolves.toEqual(readiness);
    expect(rpc).toHaveBeenCalledWith("get_portfolio_publication_readiness");
  });

  it.each([
    [{ data: null, error: { code: "XX000" } }],
    [{ data: { portfolioExists: "yes" }, error: null }],
  ])("fails closed to an empty readiness projection", async (result) => {
    const rpc = vi.fn().mockResolvedValue(result);
    await expect(getPublicationReadiness({ rpc } as never)).resolves.toMatchObject({
      portfolioExists: false,
      published: false,
    });
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

  it("sends null for an omitted value and rejects persistence failures", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "XX000" } });
    await expect(updatePublicationProgress(
      { rpc } as never,
      { action: "previewed" }
    )).rejects.toMatchObject({ code: "PUBLICATION_PROGRESS_FAILED", status: 500 });
    expect(rpc).toHaveBeenCalledWith("update_portfolio_onboarding_progress", {
      p_action: "previewed",
      p_value: null,
    });
  });

  it.each([
    { status: "unknown", readiness },
    { status: "ok", readiness: { portfolioExists: "yes" } },
  ])("rejects malformed success projections", async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    await expect(updatePublicationProgress(
      { rpc } as never,
      { action: "previewed" }
    )).rejects.toMatchObject({ code: "PUBLICATION_PROGRESS_FAILED", status: 500 });
  });

  it.each([
    ["not_found", "PORTFOLIO_DRAFT_MISSING"],
    ["verification_required", "IDENTITY_VERIFICATION_REQUIRED"],
    ["content_required", "PORTFOLIO_NOT_READY"],
  ])("maps %s without exposing database details", async (status, code) => {
    const rpc = vi.fn().mockResolvedValue({ data: { status }, error: null });
    await expect(updatePublicationProgress(
      { rpc } as never,
      { action: "confirm_disclosure", value: "publication-disclosure-v2" }
    )).rejects.toMatchObject({ code });
  });
});
