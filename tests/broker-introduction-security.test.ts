import { describe, expect, it } from "vitest";
import {
  brokerIntroductionResponseSchema,
  createBrokerIntroductionSchema,
  resolvedBrokerIntroductionSchema,
} from "@/features/broker-introductions/server/broker-introduction.contract";
import {
  createBrokerIntroductionCookie,
  brokerIntroductionCookieName,
  readBrokerIntroductionCookie,
} from "@/features/broker-introductions/server/broker-introduction.cookie";
import {
  deriveBrokerIntroductionClaimToken,
  deriveBrokerIntroductionSessionToken,
  hashBrokerIntroductionToken,
} from "@/features/broker-introductions/server/broker-introduction.token";

const introductionRef = `bir_${"a".repeat(32)}`;
const relationshipRef = `bcr_${"b".repeat(32)}`;
const recipientRelationshipRef = `bcr_${"d".repeat(32)}`;
const workspaceRef = `wrk_${"c".repeat(32)}`;

describe("broker introduction credentials and contracts", () => {
  it("derives stable, purpose-separated credentials without storing raw tokens", () => {
    const input = {
      actorUserId: "11111111-1111-4111-8111-111111111111",
      workspaceRef,
      relationshipRef,
      recipientLabel: " Priya and Family ",
      recipientEmail: " PRIYA@example.com ",
      idempotencyKey: "broker-introduction:1111111111111111",
    };
    const claim = deriveBrokerIntroductionClaimToken(input);
    expect(claim).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveBrokerIntroductionClaimToken({ ...input, recipientLabel: "priya and family", recipientEmail: "priya@example.com" })).toBe(claim);
    const session = deriveBrokerIntroductionSessionToken(introductionRef, claim);
    expect(session).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session).not.toBe(claim);
    expect(hashBrokerIntroductionToken(claim)).toMatch(/^[a-f0-9]{64}$/);
    expect(() => hashBrokerIntroductionToken("short")).toThrow("BROKER_INTRODUCTION_TOKEN_INVALID");
  });

  it("binds the HttpOnly device cookie to one introduction and detects tampering", () => {
    const token = "d".repeat(43);
    const cookie = createBrokerIntroductionCookie(introductionRef, token, new Date(Date.now() + 60_000).toISOString());
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", priority: "high" });
    expect(cookie.name).toBe(brokerIntroductionCookieName(introductionRef));
    expect(cookie.maxAge).toBeGreaterThan(0);
    expect(readBrokerIntroductionCookie(cookie.value, introductionRef)).toBe(token);
    expect(readBrokerIntroductionCookie(cookie.value, `bir_${"e".repeat(32)}`)).toBeNull();
    expect(readBrokerIntroductionCookie(`${cookie.value}x`, introductionRef)).toBeNull();
    expect(readBrokerIntroductionCookie(undefined, introductionRef)).toBeNull();
    expect(() => createBrokerIntroductionCookie("bad", token, new Date().toISOString())).toThrow("BROKER_INTRODUCTION_COOKIE_INVALID");
  });

  it("rejects caller-expanded identity fields and keeps fallback projections bounded", () => {
    expect(createBrokerIntroductionSchema.safeParse({
      relationshipRef,
      recipientRelationshipRef,
      idempotencyKey: "broker-introduction:1111111111111111",
    }).success).toBe(true);
    expect(createBrokerIntroductionSchema.safeParse({
      relationshipRef,
      recipientRelationshipRef,
      idempotencyKey: "broker-introduction:1111111111111111",
      targetBrokerId: "forbidden",
    }).success).toBe(false);
    expect(brokerIntroductionResponseSchema.parse({ response: "accepted" })).toEqual({ response: "accepted", comment: "" });
    expect(resolvedBrokerIntroductionSchema.parse({ available: false })).toEqual({ available: false });
  });
});
