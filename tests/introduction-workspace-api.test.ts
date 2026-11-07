import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntroductionAction, recordShareAction } from "@/features/broker-introductions/client/broker-introduction.api";
import { actionData, workspace, introduction } from "./introduction-workspace.fixture";
const command = { side: "source" as const, action: "initiate" as const, expectedVersion: 1, idempotencyKey: "nak204:api:000001" };
afterEach(() => vi.unstubAllGlobals());
describe("Introduction workspace client transport", () => {
  it("uses no-store GET and strict side-command response validation", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(actionData)).mockResolvedValueOnce(Response.json({ available: true, side: "source", shareState: "initiated", rowVersion: 2 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await getIntroductionAction(workspace, introduction)).toEqual(actionData);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/introductions/${introduction}`), { cache: "no-store" });
    expect(await recordShareAction(workspace, introduction, command)).toMatchObject({ side: "source", rowVersion: 2 });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "POST", body: JSON.stringify(command) });
  });
  it("rejects denied and unexpected response payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({}, { status: 403 })).mockResolvedValueOnce(Response.json({ available: false })).mockResolvedValueOnce(Response.json({ ...actionData, contact: "private" })).mockResolvedValueOnce(Response.json({ available: false })).mockResolvedValueOnce(Response.json({ unexpected: true })));
    await expect(getIntroductionAction(workspace, introduction)).rejects.toThrow("Refresh the page");
    await expect(getIntroductionAction(workspace, introduction)).rejects.toThrow("no longer available");
    await expect(getIntroductionAction(workspace, introduction)).rejects.toThrow("no longer available");
    await expect(recordShareAction(workspace, introduction, command)).rejects.toThrow("no longer available");
    await expect(recordShareAction(workspace, introduction, command)).rejects.toThrow("no longer available");
  });
});
