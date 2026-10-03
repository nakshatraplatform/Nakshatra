import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

import {
  acceptCreatorInvitation,
  creatorInvitationCommandSchema,
  hashCreatorInvitationToken,
  isCreatorInvitationValid,
  listCreatorInvitations,
  manageCreatorInvitation,
} from "../src/features/pilot-access/server/creator-invitations.service";

const token = "A".repeat(43);
const hash = createHash("sha256").update(token).digest("hex");

function client(data: unknown, error: unknown = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) };
}

describe("creator invitation service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes an exact email and rejects unsupported commands", () => {
    expect(creatorInvitationCommandSchema.parse({ email: "PERSON@GMAIL.COM", action: "grant" }).email).toBe("person@gmail.com");
    expect(creatorInvitationCommandSchema.safeParse({ email: "person@gmail.com", action: "grant", role: "admin" }).success).toBe(false);
  });

  it("hashes only correctly shaped opaque tokens", () => {
    expect(hashCreatorInvitationToken(token)).toBe(hash);
    expect(() => hashCreatorInvitationToken("short")).toThrow("Invalid invitation token");
  });

  it("validates and lists invitation records", async () => {
    const record = { email: "person@gmail.com", invited_at: "2026-10-03T00:00:00Z", expires_at: "2026-10-10T00:00:00Z", accepted_at: null, revoked_at: null };
    const success = client([record]);
    expect(await listCreatorInvitations(success as never)).toEqual([record]);
    expect(success.rpc).toHaveBeenCalledWith("list_b2c_creator_invites", { p_limit: 50 });
    await expect(listCreatorInvitations(client([], { code: "42501" }) as never)).rejects.toEqual({ code: "42501" });
    await expect(listCreatorInvitations(client([{ email: "invalid" }]) as never)).rejects.toThrow();
  });

  it("passes the action and optional hash to the administrator RPC", async () => {
    const success = client({ status: "invited" });
    expect(await manageCreatorInvitation(success as never, "person@gmail.com", "grant", hash)).toEqual({ status: "invited" });
    expect(success.rpc).toHaveBeenCalledWith("admin_manage_b2c_creator_invite", {
      p_email: "person@gmail.com", p_action: "grant", p_token_hash: hash,
    });
    const revoke = client({ status: "revoked" });
    expect(await manageCreatorInvitation(revoke as never, "person@gmail.com", "revoke")).toEqual({ status: "revoked" });
    expect(revoke.rpc).toHaveBeenCalledWith("admin_manage_b2c_creator_invite", {
      p_email: "person@gmail.com", p_action: "revoke", p_token_hash: null,
    });
    await expect(manageCreatorInvitation(client(null, { code: "42501" }) as never, "person@gmail.com", "grant")).rejects.toEqual({ code: "42501" });
  });

  it("checks a password signup against the server-only match RPC", async () => {
    const success = client(true);
    createServiceRoleClient.mockReturnValueOnce(success);
    expect(await isCreatorInvitationValid("person@gmail.com", token)).toBe(true);
    expect(success.rpc).toHaveBeenCalledWith("service_b2c_invite_matches", { p_email: "person@gmail.com", p_token_hash: hash });
    createServiceRoleClient.mockReturnValueOnce(client(false));
    expect(await isCreatorInvitationValid("person@gmail.com", token)).toBe(false);
    createServiceRoleClient.mockReturnValueOnce(client(null, { code: "DB_DOWN" }));
    await expect(isCreatorInvitationValid("person@gmail.com", token)).rejects.toEqual({ code: "DB_DOWN" });
    createServiceRoleClient.mockReturnValueOnce(client(null));
    await expect(isCreatorInvitationValid("person@gmail.com", token)).rejects.toThrow("Invite status unavailable");
  });

  it("accepts a valid invite and propagates denial", async () => {
    const success = client({ status: "accepted" });
    expect(await acceptCreatorInvitation(success as never, token)).toEqual({ status: "accepted" });
    expect(success.rpc).toHaveBeenCalledWith("accept_b2c_creator_invite", { p_token_hash: hash });
    await expect(acceptCreatorInvitation(client(null, { code: "42501" }) as never, token)).rejects.toEqual({ code: "42501" });
  });
});
