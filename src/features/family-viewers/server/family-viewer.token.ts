import "server-only";

import { createHash, createHmac } from "node:crypto";
import { normalizeInvitationEmail } from "@/features/organization-access/server/brokerdesk-team-invitation.token";
import { getBrokerdeskInvitationTokenSecret } from "@/lib/env";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function deriveFamilyViewerInvitationToken(input: {
  actorUserId: string;
  contextRef: string;
  email: string;
  idempotencyKey: string;
}) {
  return createHmac("sha256", getBrokerdeskInvitationTokenSecret())
    .update("family-viewer-invitation.v1\0")
    .update(input.actorUserId)
    .update("\0")
    .update(input.contextRef)
    .update("\0")
    .update(normalizeInvitationEmail(input.email))
    .update("\0")
    .update(input.idempotencyKey)
    .digest("base64url");
}

export function hashFamilyViewerInvitationToken(token: string) {
  if (!tokenPattern.test(token)) throw new Error("FAMILY_VIEWER_INVITATION_TOKEN_INVALID");
  return createHash("sha256").update(token).digest("hex");
}

export function isFamilyViewerInvitationToken(token: string) {
  return tokenPattern.test(token);
}
