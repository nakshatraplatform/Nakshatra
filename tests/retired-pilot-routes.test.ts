import { describe, expect, it } from "vitest";
import { GET as waitlistGet, POST as waitlistPost } from "../src/app/api/pilot-access/route";
import { GET as adminWaitlistGet, POST as adminWaitlistPost } from "../src/app/api/admin/pilot-access/route";
import { GET as invitationsGet, POST as invitationsPost } from "../src/app/api/admin/creator-invitations/route";
import { POST as acceptInvite } from "../src/app/api/pilot-invitations/accept/route";

describe("retired invite-only endpoints", () => {
  it.each([
    ["waitlist read", waitlistGet],
    ["waitlist submission", waitlistPost],
    ["admin waitlist read", adminWaitlistGet],
    ["admin waitlist mutation", adminWaitlistPost],
    ["creator invitation list", invitationsGet],
    ["creator invitation issuance", invitationsPost],
    ["creator invitation acceptance", acceptInvite],
  ])("returns a non-cacheable 410 for %s", async (_name, handler) => {
    const response = await handler();
    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ code: expect.stringMatching(/CLOSED$/) });
  });
});
