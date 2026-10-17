import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), download: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ getApiUser: mocks.auth }));
vi.mock("../src/features/portfolio/server/pdf-download.service", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/features/portfolio/server/pdf-download.service")>();
  return { ...actual, downloadPortfolioPdf: mocks.download };
});
import { POST } from "../src/app/api/portfolio/pdf/route";
import { PdfDownloadError } from "../src/features/portfolio/server/pdf-download.service";
const request = (origin = "https://www.vivintro.com") => new Request("https://www.vivintro.com/api/portfolio/pdf", { method: "POST", headers: { origin } });

describe("PDF owner endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ status: "authenticated", supabase: {}, user: { id: "owner" } });
    mocks.download.mockResolvedValue({ bytes: Buffer.from("%PDF-example"), filename: "vivintro-Test-2026-10-17.pdf" });
  });
  it("rejects cross-origin requests before authentication or generation", async () => {
    expect((await POST(request("https://elsewhere.test"))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
  });
  it("rejects an unavailable session without generation", async () => {
    mocks.auth.mockResolvedValue({ status: "missing_session" });
    expect((await POST(request())).status).toBe(401); expect(mocks.download).not.toHaveBeenCalled();
  });
  it("returns a private no-store attachment", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain('attachment; filename="vivintro-Test-2026-10-17.pdf"');
    expect(await response.text()).toBe("%PDF-example");
  });
  it("returns an actionable conflict without leaking internal errors", async () => {
    mocks.download.mockRejectedValue(new PdfDownloadError("Please download again.", "PDF_CHANGED", 409));
    expect((await POST(request())).status).toBe(409);
    mocks.download.mockRejectedValue(new Error("PRIVATE database error"));
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE");
  });
});
