import { beforeEach, expect, it, vi } from "vitest";
import { accountProfileSchema, readAccountProfile } from "@/features/account/profile";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getApiUser: mocks.auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: mocks.limit }));
import { PATCH } from "@/app/api/account/profile/route";
const names = { firstName: "李", middleName: "", lastName: "O’Connor" };
const request = (body: unknown, origin = "https://www.vivintro.com") => new Request("https://www.vivintro.com/api/account/profile", { method: "PATCH", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ status: "authenticated", user: { id: "owner" }, supabase: { auth: { updateUser: mocks.update } } });
  mocks.limit.mockResolvedValue(null);
  mocks.update.mockResolvedValue({ data: { user: { id: "owner", user_metadata: { account_first_name: names.firstName, account_middle_name: "", account_last_name: names.lastName } } }, error: null });
});
it("accepts international names and does not guess provider full names", () => {
  expect(accountProfileSchema.safeParse(names).success).toBe(true);
  expect(readAccountProfile({ user_metadata: { full_name: "Ambiguous Account Name" } }).firstName).toBe("");
});
it("saves only three own-user metadata keys with private responses", async () => {
  const result = await PATCH(request(names));
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(mocks.update).toHaveBeenCalledWith({ data: { account_first_name: names.firstName, account_middle_name: "", account_last_name: names.lastName } });
});
it.each([{ ...names, role: "admin" }, { ...names, userId: "other" }, { ...names, email: "other@test.com" }, { ...names, firstName: " " }, { ...names, lastName: "x".repeat(81) }])("rejects invalid names and mass assignment", async (body) => {
  expect((await PATCH(request(body))).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects cross-origin writes", async () => {
  expect((await PATCH(request(names, "https://evil.test"))).status).toBe(403);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("honors rate limits without a write", async () => {
  mocks.limit.mockResolvedValue(new Response(null, { status: 429 }));
  expect((await PATCH(request(names))).status).toBe(429);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects unauthenticated writes", async () => {
  mocks.auth.mockResolvedValue({ status: "missing_session" });
  expect((await PATCH(request(names))).status).toBe(401);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects an oversized body before writing", async () => {
  expect((await PATCH(request({ ...names, middleName: "x".repeat(9000) }))).status).toBe(413);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("reports provider failure without returning private provider details", async () => {
  mocks.update.mockResolvedValue({ data: { user: null }, error: { message: "secret provider detail" } });
  const result = await PATCH(request(names));
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("secret provider detail");
});
