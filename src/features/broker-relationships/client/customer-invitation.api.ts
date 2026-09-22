async function command<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(result?.error || "This action is temporarily unavailable.");
  return result;
}

export function inviteBrokerdeskCustomer(
  workspaceRef: string,
  email: string,
  idempotencyKey: string
) {
  return command<{
    invitationUrl: string;
    emailHint: string;
    expiresAt: string;
    emailStatus: "sent" | "unavailable";
  }>(
    `/api/v1/brokerdesk/workspaces/${encodeURIComponent(workspaceRef)}/customer-invitations`,
    { email, idempotencyKey }
  );
}

export function manageCustomerBrokerConsent(
  relationshipRef: string,
  action: "pause" | "renew" | "terminate",
  idempotencyKey: string
) {
  return command<{
    available: true;
    relationshipRef: string;
    relationshipStatus: "active" | "paused" | "terminated";
    endsAt: string | null;
  }>(
    `/api/v1/customer/brokers/${encodeURIComponent(relationshipRef)}/consent`,
    { action, idempotencyKey }
  );
}

