import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getBrokerdeskInvitationTokenSecret } from "@/lib/env";
import { isFamilyViewerInvitationToken } from "./family-viewer.token";

const COOKIE = "vivintro_family_invitation";
const PATH = "/api/v1/family-invitations";

function signature(token: string) {
  return createHmac("sha256", getBrokerdeskInvitationTokenSecret())
    .update(`family-viewer-invitation-cookie.v1.${token}`)
    .digest("base64url");
}

export function createFamilyInvitationCookie(token: string) {
  if (!isFamilyViewerInvitationToken(token)) throw new Error("FAMILY_VIEWER_INVITATION_TOKEN_INVALID");
  return {
    name: COOKIE,
    value: `${token}.${signature(token)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: PATH,
    maxAge: 15 * 60,
    priority: "high" as const,
  };
}

export function readFamilyInvitationCookie(value: string | undefined) {
  if (!value) return null;
  const [token, supplied, ...extra] = value.split(".");
  if (!isFamilyViewerInvitationToken(token)
    || !/^[A-Za-z0-9_-]{43}$/.test(supplied || "")
    || extra.length) return null;
  const expectedBytes = Buffer.from(signature(token));
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes) ? token : null;
}

export function clearFamilyInvitationCookie() {
  return { ...createFamilyInvitationCookie("a".repeat(43)), value: "", maxAge: 0 };
}

export const familyInvitationCookieName = COOKIE;
