// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PilotAccessAdminClient from "../src/app/admin/pilot-access/pilot-access-admin-client";

const request = {
  requestRef: `par_${"a".repeat(32)}`,
  displayName: "Aditi Rao",
  verifiedEmail: "aditi@example.com",
  phoneE164: "+14155550100",
  status: "pending",
  submittedAt: "2026-09-12T12:00:00Z",
  reviewedAt: null,
  reviewNote: null,
};

describe("pilot access administrator experience", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  it("lists verified waitlist entries without creator approval controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ requests: [request] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    expect(await screen.findByText("aditi@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/pilot-access?status=pending", { cache: "no-store" });
  });

  it("shows a safe error when the queue cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Pilot administration is unavailable." }), { status: 403 })));
    render(<PilotAccessAdminClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Pilot administration is unavailable.");
  });

  it("shows an empty waitlist and lets the administrator refresh it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ requests: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PilotAccessAdminClient />);
    expect(await screen.findByRole("heading", { name: "No waitlist entries yet" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh waitlist" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
