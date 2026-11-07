"use client";

import type { BrokerIntroductionItem } from "@/features/broker-introductions/server/broker-introduction.contract";
import { introductionActionSchema, introductionShareResultSchema, type IntroductionShareCommand } from "../server/introduction-workspace.contract";

const introductionPath = (workspaceRef: string, introductionRef: string) =>
  `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/introductions/${encodeURIComponent(introductionRef)}`;

export async function getIntroductionAction(workspaceRef: string, introductionRef: string) {
  const response = await fetch(introductionPath(workspaceRef, introductionRef), { cache: "no-store" });
  if (!response.ok) throw new Error("Refresh the page to check your current access.");
  const parsed = introductionActionSchema.safeParse(await response.json());
  if (!parsed.success || !parsed.data.available) throw new Error("This Introduction is no longer available.");
  return parsed.data;
}

export async function recordShareAction(workspaceRef: string, introductionRef: string, input: IntroductionShareCommand) {
  const data = await command<unknown>(`${introductionPath(workspaceRef, introductionRef)}/share-actions`, "POST", input);
  const parsed = introductionShareResultSchema.safeParse(data);
  if (!parsed.success || !parsed.data.available) throw new Error("This sharing action is no longer available. Refresh the page.");
  return parsed.data;
}

async function command<T>(url: string, method: "POST" | "DELETE", body: object): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data as T;
}

export function createIntroduction(workspaceRef: string, input: {
  relationshipRef: string;
  recipientRelationshipRef: string;
  idempotencyKey: string;
}) {
  return command<{
    introductionRef: BrokerIntroductionItem["introductionRef"];
    introductionUrl: string;
    sourceName: string;
    recipientLabel: string;
    recipientEmailHint: string | null;
    expiresAt: string;
    versionNumber: number;
    rowVersion: number;
    status: "created";
  }>(`/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/introductions`, "POST", input);
}

export function markIntroductionShared(workspaceRef: string, introductionRef: string, expectedVersion: number) {
  return command<{ available: true; status: "shared"; rowVersion: number }>(
    `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/introductions/${encodeURIComponent(introductionRef)}/shared`,
    "POST",
    { expectedVersion }
  );
}

export function revokeIntroduction(workspaceRef: string, introductionRef: string, expectedVersion: number) {
  return command<{ available: true; status: "revoked"; rowVersion: number }>(
    `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/introductions/${encodeURIComponent(introductionRef)}`,
    "DELETE",
    { expectedVersion }
  );
}

export function flagPortfolioUpdate(workspaceRef: string, relationshipRef: string, noticeRef: string) {
  return command<{ available: true; status: "clarification" }>(
    `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/portfolio-updates/${encodeURIComponent(noticeRef)}/clarification`,
    "POST",
    { relationshipRef }
  );
}

export function acknowledgePortfolioUpdate(workspaceRef: string, relationshipRef: string, noticeRef: string) {
  return command<{ available: true; status: "acknowledged" }>(
    `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/portfolio-updates/${encodeURIComponent(noticeRef)}/acknowledge`,
    "POST",
    { relationshipRef }
  );
}

export function markIntroductionResponseReviewed(workspaceRef: string, introductionRef: string) {
  return command<{ available: true; status: "reviewed" }>(
    `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/introductions/${encodeURIComponent(introductionRef)}/reviewed`,
    "POST",
    {}
  );
}
