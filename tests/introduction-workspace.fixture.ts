import { introductionActionSchema } from "@/features/broker-introductions/server/introduction-workspace.contract";
export const workspace = `wrk_${"a".repeat(32)}`;
export const introduction = `bir_${"b".repeat(32)}`;
export const date = "2026-11-01T12:00:00Z";
export const actionData = {
  available: true, introductionRef: introduction, status: "shared", rowVersion: 2,
  createdAt: date, expiresAt: "2026-11-16T12:00:00Z", canActivate: false,
  sides: [
    { side: "source", name: "Customer A", relationshipRef: `bcr_${"c".repeat(32)}`, response: null, respondedAt: null,
      shareState: "not_started", initiatedAt: null, confirmedAt: null, lastRemindedAt: null, reminderCount: 0,
      rowVersion: 1, canShare: true, canRemind: false },
    { side: "recipient", name: "Customer B", relationshipRef: `bcr_${"d".repeat(32)}`, response: "accepted", respondedAt: date,
      shareState: "not_started", initiatedAt: null, confirmedAt: null, lastRemindedAt: null, reminderCount: 0,
      rowVersion: 1, canShare: true, canRemind: false },
  ],
  timeline: [{ type: "created", occurredAt: date, side: null }],
};
export function actionFixture(input: unknown = actionData) {
  const data = introductionActionSchema.parse(input);
  if (!data.available) throw new Error("Expected an available fixture");
  return data;
}
export const listData = { available: true, introductions: [{ introductionRef: introduction, sourceName: "Customer A", recipientName: "Customer B", status: "shared", createdAt: date, expiresAt: "2026-11-16T12:00:00Z" }], nextCursor: null };
