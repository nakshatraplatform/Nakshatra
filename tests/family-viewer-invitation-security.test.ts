import { describe, expect, it } from "vitest";
import {
  clearFamilyInvitationCookie,
  createFamilyInvitationCookie,
  readFamilyInvitationCookie,
} from "@/features/family-viewers/server/family-viewer.cookie";
import {
  deriveFamilyViewerInvitationToken,
  hashFamilyViewerInvitationToken,
  isFamilyViewerInvitationToken,
} from "@/features/family-viewers/server/family-viewer.token";

describe("Family Viewer invitation capabilities", () => {
  it("derives a stable, domain-separated capability and stores only its hash", () => {
    const input = {
      actorUserId: "11111111-1111-4111-8111-111111111111",
      contextRef: `fvw_${"a".repeat(32)}`,
      email: "Parent@Example.com",
      idempotencyKey: "family-invite:1111111111111111",
    };
    const token = deriveFamilyViewerInvitationToken(input);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveFamilyViewerInvitationToken({ ...input, email: "parent@example.com" })).toBe(token);
    expect(deriveFamilyViewerInvitationToken({ ...input, contextRef: `fvw_${"b".repeat(32)}` })).not.toBe(token);
    expect(hashFamilyViewerInvitationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(isFamilyViewerInvitationToken("short")).toBe(false);
  });

  it("uses a signed, family-invitation-scoped, short-lived HttpOnly cookie", () => {
    const token = "a".repeat(43);
    const cookie = createFamilyInvitationCookie(token);
    expect(cookie).toMatchObject({
      httpOnly: true,
      path: "/api/v1/family-invitations",
      maxAge: 900,
      sameSite: "lax",
    });
    expect(readFamilyInvitationCookie(cookie.value)).toBe(token);
    expect(readFamilyInvitationCookie(`${cookie.value}x`)).toBeNull();
    expect(clearFamilyInvitationCookie()).toMatchObject({ value: "", maxAge: 0 });
  });
});
