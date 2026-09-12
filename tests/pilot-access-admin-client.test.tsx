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
  it("confirms and submits an approval before refreshing the queue", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ requests: [request] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "approved" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ requests: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PilotAccessAdminClient />);
    expect(await screen.findByText("aditi@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Internal review note/), "Cohort one");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("aditi@example.com"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      decision: "approve",
      reviewNote: "Cohort one",
      idempotencyKey: "pilot-review:11111111-1111-4111-8111-111111111111",
    });
  });

  it("shows a safe error when the queue cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Pilot administration is unavailable." }), { status: 403 })));
    render(<PilotAccessAdminClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Pilot administration is unavailable.");
  });
});
