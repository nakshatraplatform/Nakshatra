import { describe, expect, it, vi } from "vitest";

const getAuthenticatedUser = vi.hoisted(() => vi.fn());
const loadPilotAccessState = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("not-found"); }));
const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`redirect:${path}`); }));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser }));
vi.mock("@/features/pilot-access/server/pilot-access.service", () => ({ loadPilotAccessState }));

import PilotAccessPage from "../src/app/pilot-access/page";
import PilotAccessAdminPage from "../src/app/admin/pilot-access/page";

describe("pilot access pages", () => {
  it("redirects the legacy applicant route to the canonical waitlist", () => {
    expect(() => PilotAccessPage()).toThrow("redirect:/waitlist");
    expect(redirect).toHaveBeenCalledWith("/waitlist");
  });

  it("renders administration only for a separately authorized operator", async () => {
    getAuthenticatedUser.mockResolvedValue({ supabase: {} });
    loadPilotAccessState.mockResolvedValue({ canCreatePortfolio: false, isPilotAdministrator: true, application: null });
    await expect(PilotAccessAdminPage()).resolves.toMatchObject({ type: expect.any(Function) });
    loadPilotAccessState.mockResolvedValueOnce({ canCreatePortfolio: false, isPilotAdministrator: false, application: null });
    await expect(PilotAccessAdminPage()).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalled();
  });
});
