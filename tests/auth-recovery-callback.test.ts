import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(), getUser: vi.fn(), bootstrap: vi.fn(), completeReauth: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange, getUser: mocks.getUser } }),
}));
vi.mock("@/features/auth/server/portfolio-bootstrap", () => ({ ensureOwnerPortfolio: mocks.bootstrap }));
vi.mock("@/features/account/server/account.service", () => ({ completeAccountDeletionReauth: mocks.completeReauth }));
vi.mock("@/lib/security/logging", () => ({ getRequestId: () => "test-request", logServerError: vi.fn() }));

import { GET } from "../src/app/api/auth/callback/route";
import { createReauthTransactionCookie } from "../src/features/account/server/reauth-cookie";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchange.mockResolvedValue({ data: { redirectType: "recovery" }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
});

describe("password recovery callback", () => {
  it.each([
    [null, "/reset-password?redirect=%2Fdashboard"],
    ["/dashboard", "/reset-password?redirect=%2Fdashboard"],
    ["/p/example?interest=open", "/reset-password?redirect=%2Fp%2Fexample%3Finterest%3Dopen"],
    ["/reset-password", "/reset-password"],
    ["/reset-password?redirect=%2Fp%2Fexample", "/reset-password?redirect=%2Fp%2Fexample"],
    ["https://attacker.test", "/reset-password?redirect=%2Fdashboard"],
    ["//attacker.test", "/reset-password?redirect=%2Fdashboard"],
  ])("requires a new password before continuing to %s", async (next, expected) => {
    const url = new URL("http://local/api/auth/callback?code=synthetic");
    if (next !== null) url.searchParams.set("next", next);
    const response = await GET(new Request(url));
    expect(response.headers.get("location")).toBe(`http://local${expected}`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.completeReauth).not.toHaveBeenCalled();
  });

  it("does not turn recovery into deletion reauthentication even with a valid transaction", async () => {
    const transaction = createReauthTransactionCookie("11111111-1111-4111-8111-111111111111");
    const response = await GET(new Request("http://local/api/auth/callback?code=synthetic&reauth=account_deletion", {
      headers: { Cookie: `${transaction.name}=${transaction.value}` },
    }));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/reset-password");
    expect(mocks.completeReauth).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie") ?? "").not.toContain("nakshatra_deletion_proof=");
  });

  it("does not infer recovery from an untrusted query parameter", async () => {
    mocks.exchange.mockResolvedValueOnce({ data: { redirectType: null }, error: null });
    const response = await GET(new Request("http://local/api/auth/callback?code=synthetic&type=recovery&next=/edit"));
    expect(response.headers.get("location")).toBe("http://local/edit");
  });

  it("rejects missing, expired and reused exchange codes", async () => {
    const missing = await GET(new Request("http://local/api/auth/callback?next=/reset-password"));
    expect(missing.headers.get("location")).toBe("http://local/login?error=auth_failed");
    expect(mocks.exchange).not.toHaveBeenCalled();
    mocks.exchange.mockResolvedValueOnce({ data: { redirectType: null }, error: new Error("expired") });
    const expired = await GET(new Request("http://local/api/auth/callback?code=expired&next=/reset-password"));
    expect(expired.headers.get("location")).toBe("http://local/login?error=auth_failed");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("does not send recovery to the form when the user cannot be verified", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid user") });
    const response = await GET(new Request("http://local/api/auth/callback?code=synthetic"));
    expect(response.headers.get("location")).toBe("http://local/login?error=auth_failed");
  });
});
