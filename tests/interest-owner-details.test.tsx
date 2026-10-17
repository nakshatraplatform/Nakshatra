// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
import { GET } from "../src/app/api/interest/[id]/route";
import { GET as history } from "../src/app/api/interest/route";
import { InterestDetailsPanel } from "../src/components/portfolio/InterestDetailsPanel";
import { InterestHistoryPanel } from "../src/components/portfolio/InterestHistoryPanel";

const id = "11111111-1111-4111-8111-111111111111";
const details = { id, name: "Mira Rao", email: "mira@example.test", phone: "+1 617 555 0123", familyContext: "A thoughtful family introduction.", message: "We would like to connect.", metadata: { location_details: { city: "Boston", state: "Massachusetts", country: "United States" }, candidate: { name: "Arun Rao", email: "arun@example.test", phone: "+91 98765 43210", relationship: "Parent", location: { city: "Chennai", country: "India" } } }, submittedAt: "2026-10-01T12:00:00Z", verifiedAt: "2026-10-01T11:00:00Z", accessGrantedAt: "2026-10-02T12:00:00Z", accessExpiresAt: "2026-10-17T12:00:00Z", accessStatus: "revoked", requestStatus: "approved" };
const request = () => new Request(`http://local/api/interest/${id}`);
const context = { params: Promise.resolve({ id }) };
describe("retained owner interest details", () => {
  beforeEach(() => { vi.clearAllMocks(); enforceRateLimit.mockResolvedValue(null); });
  it("returns private noncached exact-ID details and real lineage after revocation", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: details, error: null });
    getApiUser.mockResolvedValue({ status: "authenticated", supabase: { rpc } });
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(rpc).toHaveBeenCalledWith("get_interest_details", { p_request_id: id });
    expect((await response.json()).details).toMatchObject(details);
  });
  it("fails closed for unsigned, foreign, malformed, and unavailable detail reads", async () => {
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await GET(request(), context)).status).toBe(401);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getApiUser.mockResolvedValue({ status: "authenticated", supabase: { rpc } });
    expect((await GET(request(), context)).status).toBe(404);
    expect((await GET(request(), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(404);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect((await GET(request(), context)).status).toBe(503);
    rpc.mockRejectedValueOnce(new Error("network unavailable"));
    expect((await GET(request(), context)).status).toBe(503);
    rpc.mockResolvedValueOnce({ data: { ...details, submittedAt: "invalid" }, error: null });
    expect((await GET(request(), context)).status).toBe(404);
  });
  it("shows submitted information when reopened instead of only the email", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ details }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<InterestDetailsPanel requestId={id} />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "View interest details" }));
    expect(await screen.findByText("A thoughtful family introduction.")).toBeVisible();
    expect(screen.getByText("Arun Rao")).toBeVisible();
    expect(screen.getByText("Viewer’s relationship to candidate").nextElementSibling).toHaveTextContent("Parent");
    expect(screen.getByText("Boston, Massachusetts, United States")).toBeVisible();
    expect(screen.getByText("Sharing stopped")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Hide interest details" }));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ details }), { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "View interest details" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
  it("keeps historical single-string submitted locations visible", async () => {
    const historical = { ...details, metadata: { profile_for: "self", location: "Boston, Massachusetts, United States" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ details: historical }), { status: 200 })));
    render(<InterestDetailsPanel requestId={id} />);
    fireEvent.click(screen.getByRole("button", { name: "View interest details" }));
    expect(await screen.findByText("Boston, Massachusetts, United States")).toBeVisible();
  });
  it("bounds history pages, uses owner projection and keeps old submissions reachable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id, name: "Mira Rao", submittedAt: details.submittedAt, status: "approved" }], error: null });
    getApiUser.mockResolvedValue({ status: "authenticated", supabase: { rpc } });
    const response = await history(new Request("http://local/api/interest?offset=75"));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("list_interest_history", { p_offset: 75, p_limit: 25 });
    expect((await history(new Request("http://local/api/interest?offset=-1"))).status).toBe(400);
    expect((await history(new Request("http://local/api/interest?offset=1e3"))).status).toBe(400);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ interests: [{ id, name: "Mira Rao", submittedAt: details.submittedAt, status: "approved" }] }))));
    render(<InterestHistoryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "View all interest submissions" }));
    expect(await screen.findByText("Mira Rao")).toBeVisible();
    expect(screen.getByRole("button", { name: "View interest details" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
