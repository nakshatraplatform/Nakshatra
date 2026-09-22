import { beforeEach, describe, expect, it, vi } from "vitest";

const createPublicPortfolioSnapshot = vi.hoisted(() => vi.fn((value) => ({ ...value, privacy_mode: "balanced" })));
const createServiceRoleClient = vi.hoisted(() => vi.fn());
vi.mock("@/features/portfolio/server/public-snapshot.service", () => ({ createPublicPortfolioSnapshot }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

import {
  BrokerIntroductionError,
  claimBrokerIntroductionPass,
  createBrokerIntroduction,
  flagBrokerPortfolioUpdate,
  listBrokerIntroductions,
  listBrokerPortfolioNotices,
  listOwnerBrokerIntroductionResponses,
  resolveBrokerdeskDashboard,
  markBrokerIntroductionResponseReviewed,
  acknowledgeBrokerPortfolioUpdate,
  markBrokerIntroductionShared,
  resolveBrokerIntroduction,
  respondToBrokerIntroduction,
  revokeBrokerIntroduction,
} from "@/features/broker-introductions/server/broker-introduction.service";

const workspaceRef = `wrk_${"a".repeat(32)}`;
const relationshipRef = `bcr_${"b".repeat(32)}`;
const versionRef = `pvr_${"c".repeat(32)}`;
const introductionRef = `bir_${"d".repeat(32)}`;
const noticeRef = `bpn_${"e".repeat(32)}`;
const data = { privacy_mode: "balanced", personal: { name: "Arun Rao" } };
const created = {
  status: "created", introductionRef, sourceName: "Arun Rao", recipientLabel: "Priya family",
  recipientEmailHint: null, expiresAt: "2026-10-01T00:00:00Z", versionNumber: 2, rowVersion: 1,
};

function client(handler: (name: string, args: unknown) => { data: unknown; error?: unknown }) {
  return { rpc: vi.fn(async (name: string, args: unknown) => ({ error: null, ...handler(name, args) })) };
}

describe("broker introduction service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceRoleClient.mockImplementation(() => { throw new Error("not configured"); });
  });

  it("pins the latest publication and retries once when publication races creation", async () => {
    let creates = 0;
    const supabase = client((name) => {
      if (name === "prepare_broker_introduction") return { data: { available: true, versionRef, completeData: data } };
      creates += 1;
      return creates === 1 ? { data: { status: "version_changed" } } : { data: created };
    });
    await expect(createBrokerIntroduction(supabase as never, {
      workspaceRef, relationshipRef, recipientLabel: "Priya family", recipientEmailHash: null,
      recipientEmailHint: null, claimTokenHash: "f".repeat(64), idempotencyKey: "broker-introduction:1111111111111111",
    })).resolves.toEqual(created);
    expect(createPublicPortfolioSnapshot).toHaveBeenCalledTimes(2);
  });

  it("fails closed for unavailable preparation, database errors, and two version races", async () => {
    const base = { workspaceRef, relationshipRef, recipientLabel: "Priya", recipientEmailHash: null, recipientEmailHint: null, claimTokenHash: "f".repeat(64), idempotencyKey: "broker-introduction:1111111111111111" };
    await expect(createBrokerIntroduction(client(() => ({ data: { available: false } })) as never, base)).rejects.toBeInstanceOf(BrokerIntroductionError);
    await expect(createBrokerIntroduction(client((name) => name === "prepare_broker_introduction"
      ? { data: { available: true, versionRef, completeData: data } } : { data: null, error: { code: "x" } }) as never, base)).rejects.toBeInstanceOf(BrokerIntroductionError);
    await expect(createBrokerIntroduction(client((name) => name === "prepare_broker_introduction"
      ? { data: { available: true, versionRef, completeData: data } } : { data: { status: "version_changed" } }) as never, base))
      .rejects.toMatchObject({ code: "BROKER_INTRODUCTION_VERSION_CHANGED", status: 409 });
  });

  it("validates broker lists, transitions, claims, notices, and owner responses", async () => {
    const item = {
      introductionRef: created.introductionRef, recipientLabel: created.recipientLabel,
      recipientEmailHint: created.recipientEmailHint, expiresAt: created.expiresAt,
      versionNumber: created.versionNumber, rowVersion: created.rowVersion,
      status: "shared", response: null, responseComment: null, respondedAt: null,
      createdAt: "2026-09-19T00:00:00Z",
    };
    await expect(listBrokerIntroductions(client(() => ({ data: { available: true, introductions: [item] } })) as never, workspaceRef, relationshipRef)).resolves.toMatchObject({ available: true });
    await expect(listBrokerPortfolioNotices(client(() => ({ data: { available: true, notices: [{ noticeRef, status: "unread", versionNumber: 2, publishedAt: "2026-09-19T00:00:00Z", createdAt: "2026-09-19T00:00:00Z" }] } })) as never, workspaceRef, relationshipRef)).resolves.toMatchObject({ available: true });
    await expect(markBrokerIntroductionShared(client(() => ({ data: { available: true, status: "shared", rowVersion: 2 } })) as never, workspaceRef, introductionRef, 1)).resolves.toMatchObject({ status: "shared" });
    await expect(revokeBrokerIntroduction(client(() => ({ data: { available: true, status: "revoked", rowVersion: 2 } })) as never, workspaceRef, introductionRef, 1)).resolves.toMatchObject({ status: "revoked" });
    await expect(claimBrokerIntroductionPass(client(() => ({ data: { available: true, expiresAt: "2026-10-01T00:00:00Z" } })) as never, introductionRef, "a".repeat(64), "b".repeat(64))).resolves.toMatchObject({ available: true });
    await expect(respondToBrokerIntroduction(client(() => ({ data: { available: true, status: "responded", response: "accepted" } })) as never, introductionRef, "b".repeat(64), "accepted", "Proceed")).resolves.toMatchObject({ response: "accepted" });
    await expect(flagBrokerPortfolioUpdate(client(() => ({ data: { available: true, status: "clarification" } })) as never, workspaceRef, relationshipRef, noticeRef)).resolves.toMatchObject({ status: "clarification" });
    await expect(listOwnerBrokerIntroductionResponses(client(() => ({ data: { available: true, responses: [{ introductionRef, brokerName: "Agency", recipientLabel: "Priya", response: "accepted", comment: null, respondedAt: "2026-09-19T00:00:00Z" }] } })) as never)).resolves.toHaveLength(1);
    await expect(resolveBrokerdeskDashboard(client(() => ({ data: {
      available: true, workspaceRef, workspaceName: "Agency",
      metrics: { activeCustomers: 1, openIntroductions: 1, responsesAwaitingReview: 1, portfolioUpdates: 1 },
      actions: [{ type: "response", occurredAt: "2026-09-19T00:00:00Z", relationshipRef, customerName: "Arun", introductionRef, recipientLabel: "Priya", response: "accepted" }],
    } })) as never, workspaceRef)).resolves.toMatchObject({ available: true, workspaceName: "Agency" });
    await expect(markBrokerIntroductionResponseReviewed(client(() => ({ data: { available: true, status: "reviewed" } })) as never, workspaceRef, introductionRef)).resolves.toMatchObject({ status: "reviewed" });
    await expect(acknowledgeBrokerPortfolioUpdate(client(() => ({ data: { available: true, status: "acknowledged" } })) as never, workspaceRef, relationshipRef, noticeRef)).resolves.toMatchObject({ status: "acknowledged" });
  });

  it("returns detailed fallback without private media and signs authorized broker-standard media", async () => {
    const base = { available: true, introductionRef, data, templateId: 1, themeColor: null, sunSign: null,
      expiresAt: "2026-10-01T00:00:00Z", recipientLabel: "Priya", response: null,
      responseComment: null, respondedAt: null, versionNumber: 2 };
    await expect(resolveBrokerIntroduction(client(() => ({ data: { ...base, accessMode: "detailed", media: [], horoscope: null } })) as never, introductionRef, null))
      .resolves.toMatchObject({ accessMode: "detailed", media: [] });

    const createSignedUrl = vi.fn(async (path: string) => ({ data: { signedUrl: `signed:${path}` } }));
    createServiceRoleClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } });
    const brokerStandard = { ...base, accessMode: "complete", media: [{ key: "1", accessPath: "private/photo.webp", mediaType: "hero", sortOrder: 0, presentation: "clear" }], horoscope: { accessPath: "private/chart.pdf", fileExtension: "pdf", languageLabel: null, pageCount: 2 } };
    await expect(resolveBrokerIntroduction(client(() => ({ data: brokerStandard })) as never, introductionRef, "a".repeat(64)))
      .resolves.toMatchObject({ media: [{ accessPath: "signed:private/photo.webp" }], horoscope: { accessPath: "signed:private/chart.pdf" } });
  });

  it("rejects malformed database projections without exposing their contents", async () => {
    await expect(listBrokerIntroductions(client(() => ({ data: { internal: "secret" } })) as never, workspaceRef, relationshipRef))
      .rejects.toBeInstanceOf(BrokerIntroductionError);
    await expect(resolveBrokerIntroduction(client(() => ({ data: null, error: { message: "database details" } })) as never, introductionRef, null))
      .rejects.toMatchObject({ message: "The broker introduction is unavailable." });
  });
});
