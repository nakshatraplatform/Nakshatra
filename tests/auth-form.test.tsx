// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = vi.hoisted(() => ({ get: vi.fn<(key: string) => string | null>(() => null) }));
const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const startAuthentication = vi.hoisted(() => vi.fn());
const verifyAuthenticationCode = vi.hoisted(() => vi.fn());
const continueToAuthProvider = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("../src/features/auth/client/auth.api", () => ({
  startAuthentication,
  verifyAuthenticationCode,
  continueToAuthProvider,
}));

import { AuthForm } from "../src/components/auth/AuthForm";

describe("AuthForm", () => {
  it("shows real sign-in work and removes feedback on a failed request before retry", async () => {
    let resolve!: (value: { ok: boolean; body: { error: string } }) => void;
    startAuthentication.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Example1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("status")).toHaveTextContent("Signing you in");
    expect(screen.getByRole("button", { name: "Please wait..." })).toBeDisabled();
    expect(screen.getByRole("status").querySelector("canvas")).not.toBeNull();
    await act(async () => resolve({ ok: false, body: { error: "Sign-in temporarily unavailable" } }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in temporarily unavailable");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.get.mockReturnValue(null);
  });

  it("creates an owner account and verifies the emailed code", async () => {
    startAuthentication.mockResolvedValueOnce({
      ok: true,
      body: { verificationRequired: true, email: "new@example.com" },
    });
    verifyAuthenticationCode.mockResolvedValueOnce({
      ok: true,
      body: { verified: true, redirect: "/dashboard" },
    });
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText(/your introduction begins as a private draft/i)).toBeInTheDocument();
    expect(screen.getByText(/publishing requires your own introduction/i)).toBeInTheDocument();
    expect(screen.getByText(/use that link to view it and show interest/i)).toBeInTheDocument();
    expect(screen.getByText(/Liveness checked badge appears only after those checks succeed/i)).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /access model/i })).toHaveTextContent(/Begin privately.*15 days/i);

    await user.type(screen.getByLabelText("Email address"), "New@Example.com");
    await user.type(screen.getByLabelText("Password"), "Wedding2026");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(startAuthentication).toHaveBeenCalledWith({
      method: "password_signup",
      email: "New@Example.com",
      password: "Wedding2026",
      redirect: "/dashboard",
    });
    expect(await screen.findByRole("heading", { name: /six-digit code/i })).toBeInTheDocument();
    expect(screen.getByText(/email may already be registered/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(verifyAuthenticationCode).toHaveBeenCalledWith({
      purpose: "owner_signup",
      email: "new@example.com",
      token: "123456",
      redirect: "/dashboard",
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });

  it("validates the configured signup password rules before calling the server", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);
    await user.type(screen.getByLabelText("Email address"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "onlyletters");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/letter and a number/i);
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it("signs in with email and password and preserves a safe destination", async () => {
    searchParams.get.mockImplementation((key: string) => key === "redirect" ? "/edit" : null);
    startAuthentication.mockResolvedValueOnce({
      ok: true,
      body: { authenticated: true, redirect: "/edit" },
    });
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText("Email address"), "owner@example.com");
    await user.type(screen.getByLabelText("Password"), "Wedding2026");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(startAuthentication).toHaveBeenCalledWith({
      method: "password_signin",
      email: "owner@example.com",
      password: "Wedding2026",
      redirect: "/edit",
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/edit"));
  });

  it("starts Google authentication through the guarded gateway", async () => {
    startAuthentication.mockResolvedValueOnce({
      ok: true,
      body: { url: "https://accounts.google.test/oauth" },
    });
    render(<AuthForm mode="login" />);
    await userEvent.click(screen.getByRole("button", { name: /google/i }));
    expect(startAuthentication).toHaveBeenCalledWith({ method: "google", redirect: "/dashboard" });
    expect(continueToAuthProvider).toHaveBeenCalledWith("https://accounts.google.test/oauth");
  });

  it("keeps signup provider pending and error states on the outlined Google button", async () => {
    let finish!: (value: { ok: boolean; body: { error: string } }) => void;
    startAuthentication.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<AuthForm mode="signup" />);
    const button = screen.getByRole("button", { name: "Sign up with Google" });
    expect(button).toHaveAttribute("type", "button");
    expect(screen.queryByRole("button", { name: /Twitch|Twitter/i })).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(startAuthentication).toHaveBeenCalledWith({ method: "google", redirect: "/dashboard" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    finish({ ok: false, body: { error: "Google is temporarily unavailable. Try again." } });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByRole("alert")).toHaveTextContent("Google is temporarily unavailable");
    expect(button).toHaveTextContent("Sign up with Google");
    expect(continueToAuthProvider).not.toHaveBeenCalled();
  });

  it("reuses the auth design with clear BrokerDesk continuation copy", () => {
    searchParams.get.mockImplementation((key: string) => key === "redirect" ? "/brokerdesk/onboarding" : null);
    render(<AuthForm mode="signup" />);
    expect(screen.getByRole("heading", { name: "Create your broker account" })).toBeInTheDocument();
    expect(screen.getByText(/workspace stays private/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href", "/login?redirect=%2Fbrokerdesk%2Fonboarding"
    );
  });

  it("requests password recovery without revealing whether an account exists", async () => {
    startAuthentication.mockResolvedValueOnce({ ok: true, body: { sent: true } });
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email address"), "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Send recovery email" }));
    expect(startAuthentication).toHaveBeenCalledWith({
      method: "password_recovery",
      email: "owner@example.com",
      redirect: "/dashboard",
    });
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
  });

  it("keeps credentials visible and shows a safe gateway failure", async () => {
    startAuthentication.mockResolvedValueOnce({
      ok: false,
      body: { error: "Authentication is temporarily unavailable." },
    });
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText("Email address"), "reader@example.com");
    await user.type(screen.getByLabelText("Password"), "Wedding2026");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/temporarily unavailable/i);
    expect(screen.getByLabelText("Email address")).toHaveValue("reader@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("Wedding2026");
  });

  it("supports password visibility and explains revoked sessions", async () => {
    searchParams.get.mockImplementation((key: string) => key === "error" ? "session_revoked" : null);
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("alert")).toHaveTextContent(/session has been signed out/i);
  });
});
