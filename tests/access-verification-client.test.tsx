// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  verify: vi.fn(),
  continueProvider: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/features/auth/client/auth.api", () => ({
  startAuthentication: mocks.start,
  verifyAuthenticationCode: mocks.verify,
  continueToAuthProvider: mocks.continueProvider,
}));

import { AccessVerificationClient } from "../src/app/access/[grantId]/access-verification-client";

describe("complete portfolio access verification", () => {
  const grantId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue({ ok: true, body: { sent: true } });
    mocks.verify.mockResolvedValue({ ok: true, body: { verified: true } });
  });

  it("sends and verifies a six-digit email code before refreshing access", async () => {
    render(<AccessVerificationClient grantId={grantId} />);
    fireEvent.change(screen.getByLabelText(/verified email address/i), { target: { value: "viewer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    expect(await screen.findByText(/code sent to/i)).toBeInTheDocument();
    const verifyButton = screen.getByRole("button", { name: /verify and view portfolio/i });
    expect(verifyButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/six-digit code/i), { target: { value: "12ab3456" } });
    expect(verifyButton).toBeEnabled();
    fireEvent.click(verifyButton);

    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith({
      purpose: "viewer_interest",
      email: "viewer@example.com",
      token: "123456",
      redirect: `/access/${grantId}`,
    }));
    expect(mocks.replace).toHaveBeenCalledWith(`/access/${grantId}`);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("clears an invalid code and displays a safe retry message", async () => {
    mocks.verify.mockResolvedValue({ ok: false, body: { error: "That code has expired." } });
    render(<AccessVerificationClient grantId={grantId} />);
    fireEvent.change(screen.getByLabelText(/verified email address/i), { target: { value: "viewer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));
    const code = await screen.findByLabelText(/six-digit code/i);
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and view portfolio/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code has expired.");
    expect(code).toHaveValue("");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("starts Google verification with the grant-bound return URL", async () => {
    mocks.start.mockResolvedValue({ ok: true, body: { url: "https://accounts.google.test/oauth" } });
    render(<AccessVerificationClient grantId={grantId} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith({
      method: "google",
      redirect: `/access/${grantId}`,
    }));
    expect(mocks.continueProvider).toHaveBeenCalledWith("https://accounts.google.test/oauth");
  });
});
