// Loopback-only browser fixture. Production RPCs remain the authority.
export const introductionWorkspaceFixture = {
  available: true, introductionRef: "bir_" + "a".repeat(32), status: "shared", rowVersion: 2,
  createdAt: "2026-11-01T12:00:00Z", expiresAt: "2026-11-16T12:00:00Z", canActivate: false,
  sides: ["source", "recipient"].map((side, index) => ({
    side, name: index ? "Family fixture customer B" : "Family fixture customer A",
    relationshipRef: "bcr_" + (index ? "b" : "a").repeat(32), response: null, respondedAt: null,
    shareState: "not_started", initiatedAt: null, confirmedAt: null, lastRemindedAt: null,
    reminderCount: 0, rowVersion: 1, canShare: true, canRemind: false,
  })),
  timeline: [{ type: "created", occurredAt: "2026-11-01T12:00:00Z", side: null }],
};
