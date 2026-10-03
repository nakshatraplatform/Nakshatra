// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

import InviteAcceptanceClient from "../src/app/invite/[token]/invite-acceptance-client";

describe("pilot invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("activates the signed-in invited account and follows the server redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ redirect: "/dashboard" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<InviteAcceptanceClient token="opaque-token" />);
    await userEvent.click(screen.getByRole("button", { name: "Activate pilot access" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/pilot-invitations/accept", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "opaque-token" }),
    });
  });

  it("keeps the invitation page actionable when the account is not eligible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "This account is not invited." }), { status: 403 })));
    render(<InviteAcceptanceClient token="opaque-token" />);
    await userEvent.click(screen.getByRole("button", { name: "Activate pilot access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This account is not invited.");
    expect(screen.getByRole("button", { name: "Activate pilot access" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out locally and preserves the invite path for a different account", async () => {
    render(<InviteAcceptanceClient token="opaque-token" />);
    await userEvent.click(screen.getByRole("button", { name: "Use a different account" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?redirect=%2Finvite%2Fopaque-token"));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(refresh).toHaveBeenCalledOnce();
  });
});
