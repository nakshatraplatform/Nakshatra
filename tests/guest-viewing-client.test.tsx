// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ hydrated: false, request: vi.fn() }));
vi.mock("@/lib/ui/use-hydrated", () => ({ useHydrated: () => mocks.hydrated }));
vi.mock("@/components/brand/VivIntroBrand", () => ({ VivIntroBrand: () => <span>VivIntro</span> }));
vi.mock("@/lib/api/bounded-json-request", () => ({ boundedJsonRequest: mocks.request }));
import { GuestPortfolioVerification } from "@/app/p/[token]/view/verification-client";
beforeEach(() => { mocks.hydrated = false; mocks.request.mockReset(); });
it("does not accept visitor input before the verification form has hydrated", () => {
  const view = render(<GuestPortfolioVerification token="portfolio-token" />);
  expect(screen.getByLabelText("Approved email address")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send viewing code" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Preparing secure form");
  mocks.hydrated = true;
  view.rerender(<GuestPortfolioVerification token="portfolio-token" />);
  expect(screen.getByLabelText("Approved email address")).toBeEnabled();
});
it("keeps the verified email context after a wrong code and bounds numeric code input", async () => {
  mocks.hydrated = true;
  mocks.request.mockResolvedValueOnce({ response: { ok: true }, body: { challengeId: "11111111-1111-4111-8111-111111111111" } });
  render(<GuestPortfolioVerification token="portfolio-token" />);
  fireEvent.change(screen.getByLabelText("Approved email address"), { target: { value: "guest@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Send viewing code" }));
  const code = await screen.findByLabelText("Six-digit viewing code");
  fireEvent.change(code, { target: { value: "abc0000007" } });
  expect(code).toHaveValue("000000");
  mocks.request.mockResolvedValueOnce({ response: { ok: false }, body: { error: "That code is incorrect. Try again." } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and view portfolio" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("incorrect"));
  expect(screen.getByLabelText("Approved email address")).toHaveValue("guest@example.test");
  expect(code).toHaveValue("");
  expect(mocks.request.mock.calls[1][1].body).toContain('"email":"guest@example.test"');
});
