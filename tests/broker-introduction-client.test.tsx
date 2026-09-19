// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/templates", () => ({
  BiodataTemplate: ({ accessMode, interestAction }: { accessMode: string; interestAction?: React.ReactNode }) => <div data-testid="template" data-mode={accessMode}>{interestAction}</div>,
}));

import { BrokerIntroductionClient } from "../src/app/introductions/[introductionRef]/broker-introduction-client";

const introductionRef = `bir_${"a".repeat(32)}`;
const base = {
  available: true,
  introductionRef,
  data: { privacy_mode: "balanced", personal: { name: "Arun" } },
  media: [], horoscope: null, templateId: 1, themeColor: null, sunSign: null,
  expiresAt: "2026-10-01T00:00:00Z", recipientLabel: "Priya",
  response: null, responseComment: null, respondedAt: null, versionNumber: 3,
};

describe("broker introduction recipient client", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));
  afterEach(() => vi.unstubAllGlobals());

  it("exchanges a fragment pass, clears it, and renders the pinned Complete Portfolio", async () => {
    window.history.replaceState(null, "", `/introductions/${introductionRef}#pass=${"p".repeat(43)}`);
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ready: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...base, accessMode: "complete" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<BrokerIntroductionClient introductionRef={introductionRef} />);
    expect(screen.getByText("Opening this introduction…")).toBeInTheDocument();
    await screen.findByText("Complete Portfolio · trusted broker introduction");
    expect(window.location.hash).toBe("");
    expect(screen.getByTestId("template")).toHaveAttribute("data-mode", "approved");
    expect(screen.getByText("Your response")).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toContain("/exchange");
  });

  it("renders forwarded links as Detailed Introduction without response controls", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...base, accessMode: "detailed" }), { status: 200 })));
    render(<BrokerIntroductionClient introductionRef={introductionRef} />);
    await screen.findByText("Detailed Introduction · forwarded-link protection");
    expect(screen.getByTestId("template")).toHaveAttribute("data-mode", "public");
    expect(screen.queryByText("Your response")).not.toBeInTheDocument();
  });

  it("records one response and replaces the form with its immutable result", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...base, accessMode: "complete" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ available: true, status: "responded", response: "accepted" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<BrokerIntroductionClient introductionRef={introductionRef} />);
    await screen.findByText("Your response");
    fireEvent.click(screen.getByLabelText("Interested in continuing"));
    fireEvent.change(screen.getByLabelText("Optional note"), { target: { value: "Please continue" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit response" }));
    await screen.findByText(/Response recorded:/);
    expect(fetch.mock.calls[1][1]?.body).toContain('"response":"accepted"');
  });

  it("fails closed for missing references, failed reads, and rejected responses", async () => {
    const { unmount } = render(<BrokerIntroductionClient introductionRef="" />);
    await screen.findByText("This introduction is unavailable");
    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: false }), { status: 404 })));
    render(<BrokerIntroductionClient introductionRef={introductionRef} />);
    await screen.findByText("This introduction is unavailable");
  });

  it("shows a retry-safe error when response recording fails", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...base, accessMode: "complete" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ available: false }), { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    render(<BrokerIntroductionClient introductionRef={introductionRef} />);
    await screen.findByText("Your response");
    fireEvent.click(screen.getByLabelText("Decline respectfully"));
    fireEvent.click(screen.getByRole("button", { name: "Submit response" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not be recorded"));
  });
});
