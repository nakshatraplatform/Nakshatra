import { describe, expect, it, vi } from "vitest";
import { loadRelationshipPage } from "@/features/access/server/relationship-dashboard.service";
import { relationshipQuerySchema } from "@/features/access/relationship-dashboard.contract";

const page = { records: [], total: 62, counts: { interests: 62, awaiting: 51, setAside: 5, active: 1 }, disclosure: null };
describe("owner relationship page", () => {
  it("passes bounded page/search inputs to the authenticated owner RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: page, error: null });
    await expect(loadRelationshipPage({ rpc } as never, { queue: "awaiting", offset: 56, query: " Old Viewer " })).resolves.toEqual(page);
    expect(rpc).toHaveBeenCalledWith("get_owner_relationship_page", { p_queue: "awaiting", p_offset: 56, p_query: "Old Viewer", p_filter: "all" });
  });
  it.each([
    { offset: -1 }, { offset: 100001 }, { offset: 1.5 }, { query: "a".repeat(81) }, { queue: "foreign" }, { filter: "unknown" },
  ])("rejects invalid read input before a database request: %j", async input => {
    const rpc = vi.fn();
    expect(relationshipQuerySchema.safeParse(input).success).toBe(false);
    await expect(loadRelationshipPage({ rpc } as never, input as never)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { code: "42501", message: "private database message" } },
    { data: { ...page, counts: { active: 0 } }, error: null },
    { data: { ...page, total: -1 }, error: null },
    { data: { ...page, disclosure: { data: {} } }, error: null },
  ])("fails visibly rather than fabricating empty status: %j", async result => {
    const rpc = vi.fn().mockResolvedValue(result);
    await expect(loadRelationshipPage({ rpc } as never)).rejects.toThrow("We could not load requests and sharing access");
  });
});
