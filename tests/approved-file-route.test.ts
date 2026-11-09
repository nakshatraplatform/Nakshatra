import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/p/[token]/files/[file]/route";

const { createClient, getUser, rpc, createServiceRoleClient, from, download, asStream } = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), createServiceRoleClient: vi.fn(), from: vi.fn(),
  download: vi.fn(), asStream: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

const photoKey = "protected-photo";
const photoFile = `photo-${photoKey}`;
const token = "test-profile";
const future = () => new Date(Date.now() + 600_000).toISOString();
const photoApproval = () => ({
  data: { personal: { name: "Approved" } }, templateId: 3, accessExpiresAt: future(),
  media: [{ key: photoKey, accessPath: "owner/profile/private.webp", mediaType: "gallery", sortOrder: 0, presentation: "clear" }],
});
const documentApproval = () => ({
  accessPath: "owner/profile/horoscope.webp", mimeType: "image/webp", fileExtension: "webp", accessExpiresAt: future(),
});

function openFile(file = photoFile, pathToken = token) {
  return GET(new Request("https://www.vivintro.test/p/test-profile/files/fixture"), {
    params: Promise.resolve({ token: pathToken, file }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  createClient.mockResolvedValue({ auth: { getUser }, rpc });
  getUser.mockResolvedValue({ data: { user: { email: "approved@example.test", email_confirmed_at: "2026-10-01" } }, error: null });
  rpc.mockImplementation(async (name: string) => ({
    data: name === "resolve_approved_horoscope" ? documentApproval() : photoApproval(), error: null,
  }));
  createServiceRoleClient.mockReturnValue({ storage: { from } });
  from.mockReturnValue({ download });
  download.mockReturnValue({ asStream });
  asStream.mockImplementation(async () => ({ data: new Response("image bytes").body, error: null }));
});

describe("account-protected file delivery", () => {
  it.each([
    [photoFile, "resolve_approved_portfolio", "photos", "owner/profile/private.webp"],
    ["horoscope", "resolve_approved_horoscope", "horoscopes", "owner/profile/horoscope.webp"],
  ])("serves %s through VivIntro and denies the same URL immediately after revocation", async (file, resolver, bucket, storagePath) => {
    const first = await openFile(file);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toContain("no-store");
    expect(first.headers.get("content-type")).toBe("image/webp");
    expect(first.headers.has("location")).toBe(false);
    expect(await first.text()).toBe("image bytes");
    expect(rpc).toHaveBeenCalledWith(resolver, { p_share_token: token });
    expect(from).toHaveBeenCalledWith(bucket);
    expect(download).toHaveBeenCalledWith(storagePath, {}, expect.objectContaining({ signal: expect.any(AbortSignal) }));

    rpc.mockResolvedValue({ data: null, error: null });
    const afterRevocation = await openFile(file);
    expect(afterRevocation.status).toBe(404);
    expect(afterRevocation.headers.get("cache-control")).toContain("no-store");
    expect(download).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["missing session", null],
    ["unverified email", { email: "approved@example.test" }],
    ["anonymous user", { email: "approved@example.test", email_confirmed_at: "2026-10-01", is_anonymous: true }],
  ])("denies a forwarded URL with %s", async (_reason, user) => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    expect((await openFile()).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it.each([photoFile, "horoscope"])("denies %s to a signed-in account without its own approval", async file => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await openFile(file)).status).toBe(404);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("rejects a foreign photo key and malformed URL components before privileged access", async () => {
    expect((await openFile("photo-foreign")).status).toBe(404);
    expect((await openFile("photo-../file.webp")).status).toBe(404);
    expect((await openFile(photoFile, "invalid/token")).status).toBe(404);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("does not return partial permissions on RPC or Storage failures", async () => {
    rpc.mockResolvedValueOnce({ data: photoApproval(), error: { code: "42501" } });
    expect((await openFile()).status).toBe(404);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    asStream.mockResolvedValueOnce({ data: null, error: { code: "TEMPORARY_FAILURE" } });
    const response = await openFile();
    expect(response.status).toBe(503);
    expect(response.headers.has("location")).toBe(false);
  });
});
