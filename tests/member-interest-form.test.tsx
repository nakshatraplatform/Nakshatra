// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MemberInterestForm } from "@/components/portfolio/MemberInterestForm";
const context = { available: true, name: "Published Member", revision: "a".repeat(32), photoCount: 2, privatePhotoCount: 1,
  hasHoroscope: true, alreadySent: false, requestStatus: null, sharingActive: false };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { fetcher = vi.fn(async () => Response.json(context)); vi.stubGlobal("fetch", fetcher); });
it("sends the published profile with one clearly labelled action and no repeated identity form or OTP", async () => {
  const sent = vi.fn();
  render(<MemberInterestForm token="target-portfolio" recipientName="Ananya" onUnavailable={vi.fn()} onSent={sent} />);
  expect(await screen.findByText(/Sharing Published Member/)).toBeVisible();
  expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Six-digit code")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Message (optional)"), { target: { value: "Hello, happy to connect." } });
  fetcher.mockResolvedValueOnce(Response.json({ submitted: true, mutual: false }, { status: 201 }));
  fireEvent.click(screen.getByRole("button", { name: "Send interest and share my full profile with Ananya" }));
  await waitFor(() => expect(sent).toHaveBeenCalledWith(false));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ portfolioToken: "target-portfolio", revision: "a".repeat(32), scope: "full_portfolio", message: "Hello, happy to connect." });
});
it("does not offer a new send or extend access for an existing interest", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ...context, alreadySent: true, requestStatus: "approved", sharingActive: true }));
  render(<MemberInterestForm token="target-portfolio" recipientName="Ananya" onUnavailable={vi.fn()} onSent={vi.fn()} />);
  expect(await screen.findByText(/Interest already sent/)).toBeVisible();
  expect(screen.queryByRole("button", { name: /Send interest and share/ })).not.toBeInTheDocument();
});
it("falls back only when the server confirms no eligible published profile", async () => {
  const unavailable = vi.fn();
  fetcher.mockResolvedValueOnce(Response.json({ available: false }));
  render(<MemberInterestForm token="target-portfolio" recipientName="Ananya" onUnavailable={unavailable} onSent={vi.fn()} />);
  await waitFor(() => expect(unavailable).toHaveBeenCalledOnce());
});
it("preserves the message and reloads the disclosure after a stale revision", async () => {
  render(<MemberInterestForm token="target-portfolio" recipientName="Ananya" onUnavailable={vi.fn()} onSent={vi.fn()} />);
  const message = await screen.findByLabelText("Message (optional)");
  fireEvent.change(message, { target: { value: "Keep my message." } });
  fetcher.mockResolvedValueOnce(Response.json({ error: "Published profile changed.", code: "SHARING_REVIEW_CHANGED" }, { status: 409 }));
  fetcher.mockResolvedValueOnce(Response.json({ ...context, revision: "b".repeat(32) }));
  fireEvent.click(screen.getByRole("button", { name: /Send interest and share/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(await screen.findByLabelText("Message (optional)")).toHaveValue("Keep my message.");
  expect(screen.getByRole("alert")).toHaveTextContent("Published profile changed");
});
