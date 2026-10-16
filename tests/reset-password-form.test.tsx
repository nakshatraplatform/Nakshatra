// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateRecoveredPassword = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/client/auth.api", () => ({ updateRecoveredPassword }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { ResetPasswordForm } from "../src/components/auth/ResetPasswordForm";
import ResetPasswordPage, { metadata } from "../src/app/reset-password/page";

describe("password recovery form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateRecoveredPassword.mockResolvedValue({ ok: true, body: { updated: true } });
  });

  it("renders the private reset-password page metadata and form", async () => {
    render(await ResetPasswordPage());
    expect(screen.getByRole("heading", { name: "Choose a new password." })).toBeInTheDocument();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("requires matching passwords before submitting", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New password"), "NewPassword1");
    await user.type(screen.getByLabelText("Confirm new password"), "DifferentPassword2");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The passwords do not match.");
    expect(updateRecoveredPassword).not.toHaveBeenCalled();
  });

  it("passes the interrupted introduction from the page query through to recovery", async () => {
    render(await ResetPasswordPage({ searchParams: Promise.resolve({ redirect: "/p/shared-token#portfolio-interest" }) }));
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login?redirect=%2Fp%2Fshared-token%23portfolio-interest");
  });

  it("updates the password and returns to the dashboard", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New password"), "NewPassword1");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPassword1");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(updateRecoveredPassword).toHaveBeenCalledWith("NewPassword1");
    expect(replace).toHaveBeenCalledWith("/dashboard?password=updated");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a safe recovery error and supports password visibility", async () => {
    const user = userEvent.setup();
    updateRecoveredPassword.mockResolvedValueOnce({
      ok: false,
      body: { error: "This recovery link has expired." },
    });
    render(<ResetPasswordForm />);
    const password = screen.getByLabelText("New password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(password).toHaveAttribute("type", "text");
    await user.type(password, "NewPassword1");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPassword1");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This recovery link has expired.");
  });

  it.each(["/p/shared-token#portfolio-interest", "//outside.example"])("resumes a safe interrupted journey after reset: %s", async (returnTo) => {
    const user = userEvent.setup();
    render(<ResetPasswordForm returnTo={returnTo} />);
    await user.type(screen.getByLabelText("New password"), "NewPassword1");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPassword1");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(replace).toHaveBeenCalledWith(returnTo.startsWith("/p/") ? returnTo : "/dashboard?password=updated");
  });
});
