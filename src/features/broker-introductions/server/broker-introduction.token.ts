import "server-only";

import { createHash, createHmac } from "node:crypto";
import { getBrokerdeskInvitationTokenSecret } from "@/lib/env";
import { normalizeInvitationEmail } from "@/features/organization-access/server/brokerdesk-team-invitation.token";
import { brokerIntroductionTokenSchema } from "./broker-introduction.contract";

function hmac(purpose: string, values: string[]) {
  const digest = createHmac("sha256", getBrokerdeskInvitationTokenSecret());
  digest.update(`broker-introduction.${purpose}.v1\0`);
  values.forEach((value) => { digest.update(value); digest.update("\0"); });
  return digest.digest("base64url");
}

/** A retry of the same command produces the same one-time capability. */
export function deriveBrokerIntroductionClaimToken(input: {
  actorUserId: string;
  workspaceRef: string;
  relationshipRef: string;
  recipientLabel: string;
  recipientEmail?: string;
  idempotencyKey: string;
}) {
  return hmac("claim", [
    input.actorUserId,
    input.workspaceRef,
    input.relationshipRef,
    input.recipientLabel.trim().toLowerCase(),
    input.recipientEmail ? normalizeInvitationEmail(input.recipientEmail) : "",
    input.idempotencyKey,
  ]);
}

/** Makes exchange retries converge on the same device session without storing the raw claim token. */
export function deriveBrokerIntroductionSessionToken(introductionRef: string, claimToken: string) {
  return hmac("device-session", [introductionRef, claimToken]);
}

export function hashBrokerIntroductionToken(token: string) {
  if (!brokerIntroductionTokenSchema.safeParse(token).success) {
    throw new Error("BROKER_INTRODUCTION_TOKEN_INVALID");
  }
  return createHash("sha256").update(token).digest("hex");
}
