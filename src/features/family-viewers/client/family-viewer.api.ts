"use client";

import { boundedJsonRequest } from "@/lib/api/bounded-json-request";

type ApiError = { error?: string };

export async function proposeFamilyViewer(workspaceRef: string, relationshipRef: string, input: {
  email: string;
  displayName: string;
  relationshipKind: string;
  relationshipLabel: string | null;
  preferredLocale: string | null;
  idempotencyKey: string;
}) {
  const { response, body } = await boundedJsonRequest<{ accepted: true } & ApiError>(
    `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}`
      + `/customers/${encodeURIComponent(relationshipRef)}/family-proposals`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok || !body?.accepted) {
    throw new Error(body?.error || "The family contact proposal could not be saved.");
  }
  return body;
}

async function command<T>(url: string, method: "POST" | "DELETE", body: object): Promise<T> {
  const result = await boundedJsonRequest<T & ApiError>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!result.response.ok || !result.body) {
    throw new Error(result.body?.error || "The family representative change could not be saved.");
  }
  return result.body;
}

export function createFamilyViewer(input: {
  email: string;
  displayName: string;
  relationshipKind: string;
  relationshipLabel: string | null;
  preferredLocale: string | null;
  idempotencyKey: string;
}) {
  return command<{
    available: true;
    invitationUrl: string;
    emailStatus: "sent" | "unavailable";
  }>("/api/v1/customer/family-viewers", "POST", input);
}

export function decideFamilyViewerProposal(viewerRef: string, input:
  | { decision: "approve"; email: string; idempotencyKey: string }
  | { decision: "reject"; idempotencyKey: string }
) {
  return command<{
    available: true;
    invitationUrl?: string;
    emailStatus?: "sent" | "unavailable";
  }>(`/api/v1/customer/family-viewers/${encodeURIComponent(viewerRef)}/decision`, "POST", input);
}

export function setPrimaryFamilyViewer(viewerRef: string, expectedVersion: number) {
  return command<{ available: true }>(
    `/api/v1/customer/family-viewers/${encodeURIComponent(viewerRef)}/primary`,
    "POST",
    { expectedVersion, idempotencyKey: `family-primary:${crypto.randomUUID()}` }
  );
}

export function revokeFamilyViewer(viewerRef: string, expectedVersion: number) {
  return command<{ available: true }>(
    `/api/v1/customer/family-viewers/${encodeURIComponent(viewerRef)}`,
    "DELETE",
    { expectedVersion, idempotencyKey: `family-revoke:${crypto.randomUUID()}` }
  );
}
