import { expect, it, vi } from "vitest";
import { loadAccountHeaderProfile } from "@/features/account/server/account-header-profile";

type Session = Parameters<typeof loadAccountHeaderProfile>[0];
function session(draft: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { draft_data: draft }, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { value: { supabase: { from }, user: { id: "owner", user_metadata: { account_first_name: "Account", account_last_name: "Owner" } } } as unknown as Session, from, select, eq, maybeSingle };
}
it("reads only the verified owner's self-created name projection", async () => {
  const fixture = session({ personal: { profile_for: "self", first_name: "Mary Jane", last_name: "Rao" } });
  expect(await loadAccountHeaderProfile(fixture.value)).toEqual({ firstName: "Mary Jane", middleName: "", lastName: "Rao" });
  expect(fixture.from).toHaveBeenCalledWith("portfolios");
  expect(fixture.select).toHaveBeenCalledWith("draft_data");
  expect(fixture.eq).toHaveBeenCalledWith("user_id", "owner");
});
it.each([null, {}, { personal: { profile_for: "daughter", first_name: "Other", last_name: "Person" } }])("falls back to account names without borrowing another person's identity", async draft => {
  expect(await loadAccountHeaderProfile(session(draft).value)).toEqual({ firstName: "Account", middleName: "", lastName: "Owner" });
});
it("keeps identity fallback available on returned or thrown read failures", async () => {
  const fixture = session(null, new Error("offline"));
  expect((await loadAccountHeaderProfile(fixture.value)).firstName).toBe("Account");
  fixture.maybeSingle.mockRejectedValueOnce(new Error("offline"));
  expect((await loadAccountHeaderProfile(fixture.value)).lastName).toBe("Owner");
});
