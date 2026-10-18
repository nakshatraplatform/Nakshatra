import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { resolveExistingViewerProfile } from "@/features/interest/server/existing-viewer-profile.service";

function createSupabaseClient(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
    maybeSingle,
  };
}

describe("existing viewer profile resolver", () => {
  it("reuses only valid owned profession and core values with published fallback", async () => {
    const { client } = createSupabaseClient({
      draft_data: { personal: { name: "Mira Rao" }, career: { title: "Engineer" }, lifestyle: { values_statement: 123 } },
      published_data: { career: { title: "Older profession" }, lifestyle: { values_statement: "Kindness and mutual respect" } },
    });
    await expect(resolveExistingViewerProfile(client, "viewer-1")).resolves.toMatchObject({ profession: "Engineer", coreValues: "Kindness and mutual respect" });
  });
  it("returns null when the viewer has no portfolio", async () => {
    const { client } = createSupabaseClient(null);

    await expect(resolveExistingViewerProfile(client, "viewer-1")).resolves.toBeNull();
  });

  it("falls back to published data, a contact entry, and the self profile type", async () => {
    const { client, from, select, eq } = createSupabaseClient({
      draft_data: [],
      published_data: {
        personal: {
          name: "  Rohan Mehta  ",
          profile_for: "friend",
          country: "Canada",
          region: "Ontario",
          city: "Toronto",
        },
        contact: {
          phone: "",
          contacts: [
            { relationship: "father", name: "Raj Mehta", phone: "" },
            { relationship: "mother", name: "Maya Mehta", phone: "+1 416 555 0100" },
          ],
        },
      },
    });

    await expect(resolveExistingViewerProfile(client, "viewer-2")).resolves.toEqual({
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 416 555 0100",
      country: "Canada",
      state: "Ontario",
      city: "Toronto",
    });
    expect(from).toHaveBeenCalledWith("portfolios");
    expect(select).toHaveBeenCalledWith("draft_data,published_data");
    expect(eq).toHaveBeenCalledWith("user_id", "viewer-2");
  });

  it("prefers reusable draft identity and its direct phone number", async () => {
    const { client } = createSupabaseClient({
      draft_data: {
        personal: { name: "Aditi Rao", profile_for: "daughter", city: "Boston" },
        contact: { phone: "  +1 617 555 0101  " },
      },
      published_data: {
        personal: { name: "Older Name", profile_for: "self" },
        contact: { phone: "+1 000 000 0000" },
      },
    });

    await expect(resolveExistingViewerProfile(client, "viewer-3")).resolves.toMatchObject({
      name: "Aditi Rao",
      profileFor: "daughter",
      phone: "+1 617 555 0101",
      city: "Boston",
    });
  });

  it("normalizes legacy provider region codes to ISO subdivision codes", async () => {
    const { client } = createSupabaseClient({
      draft_data: {
        personal: {
          name: "Legacy Viewer",
          country: "United States",
          country_code: "US",
          region: "Massachusetts",
          region_code: "MA",
          city: "Boston",
        },
        contact: { phone: "+1 617 555 0101" },
      },
      published_data: null,
    });

    await expect(resolveExistingViewerProfile(client, "viewer-legacy")).resolves.toMatchObject({
      countryCode: "US",
      subdivisionCode: "US-MA",
    });
  });

  it("returns null when neither source contains a usable name", async () => {
    const { client } = createSupabaseClient({
      draft_data: { personal: { name: "" }, contact: { phone: "+1 617 555 0101" } },
      published_data: null,
    });

    await expect(resolveExistingViewerProfile(client, "viewer-4")).resolves.toBeNull();
  });
});
