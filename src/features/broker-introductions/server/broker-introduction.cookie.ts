import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getBrokerdeskInvitationTokenSecret } from "@/lib/env";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { brokerIntroductionTokenSchema } from "./broker-introduction.contract";

const COOKIE_PREFIX = "vivintro_broker_introduction_";

export function brokerIntroductionCookieName(introductionRef: string) {
  if (!brokerIntroductionRouteRefSchema.safeParse(introductionRef).success) {
    throw new Error("BROKER_INTRODUCTION_COOKIE_INVALID");
  }
  return `${COOKIE_PREFIX}${introductionRef}`;
}

function signature(introductionRef: string, token: string) {
  return createHmac("sha256", getBrokerdeskInvitationTokenSecret())
    .update(`broker-introduction-cookie.v1.${introductionRef}.${token}`)
    .digest("base64url");
}

export function createBrokerIntroductionCookie(introductionRef: string, token: string, expiresAt: string) {
  if (!brokerIntroductionRouteRefSchema.safeParse(introductionRef).success
    || !brokerIntroductionTokenSchema.safeParse(token).success) {
    throw new Error("BROKER_INTRODUCTION_COOKIE_INVALID");
  }
  const maxAge = Math.max(0, Math.min(14 * 86_400, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)));
  return {
    name: brokerIntroductionCookieName(introductionRef),
    value: `${introductionRef}.${token}.${signature(introductionRef, token)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

export function readBrokerIntroductionCookie(value: string | undefined, expectedRef: string) {
  if (!value) return null;
  const [introductionRef, token, supplied, ...extra] = value.split(".");
  if (extra.length || introductionRef !== expectedRef
    || !brokerIntroductionRouteRefSchema.safeParse(introductionRef).success
    || !brokerIntroductionTokenSchema.safeParse(token).success
    || !brokerIntroductionTokenSchema.safeParse(supplied).success) return null;
  const expected = Buffer.from(signature(introductionRef, token));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? token : null;
}
