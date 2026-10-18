// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const update = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/features/auth/client/auth.api", () => ({ updateRecoveredPassword: update }));
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import ResetPasswordPage, { metadata } from "@/app/reset-password/page";

beforeEach(() => vi.clearAllMocks());
describe("password recovery form", () => {
  beforeEach(() => update.mockResolvedValue({ ok: true, body: { updated: true } }));

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
    expect(update).not.toHaveBeenCalled();
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
    expect(update).toHaveBeenCalledWith("NewPassword1");
    expect(replace).toHaveBeenCalledWith("/dashboard?password=updated");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a safe recovery error and supports password visibility", async () => {
    const user = userEvent.setup();
    update.mockResolvedValueOnce({ ok: false, body: { error: "This recovery link has expired." } });
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

  it.each(["/p/shared-token#portfolio-interest", "//outside.example"])("resumes a safe interrupted journey after reset: %s", async returnTo => {
    const user = userEvent.setup();
    render(<ResetPasswordForm returnTo={returnTo} />);
    await user.type(screen.getByLabelText("New password"), "NewPassword1");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPassword1");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(replace).toHaveBeenCalledWith(returnTo.startsWith("/p/") ? returnTo : "/dashboard?password=updated");
  });
});
async function fill(password: string, confirmation: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password", { exact: true }), password);
  await user.type(screen.getByLabelText("Confirm new password"), confirmation);
  await user.click(screen.getByRole("button", { name: "Save new password" }));
  return user;
}
describe("accessible password recovery", () => {
  it("associates mismatch feedback with confirmation without suggesting a new email", async () => {
    render(<ResetPasswordForm />);
    const user = await fill("Wedding2026", "Different2026");
    const confirmation = screen.getByLabelText("Confirm new password");
    expect(confirmation).toHaveFocus();
    expect(confirmation).toHaveAttribute("aria-invalid", "true");
    expect(confirmation.getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByRole("alert").id);
    expect(screen.queryByRole("link", { name: /request a new recovery email/i })).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    await user.type(confirmation, "1");
    expect(confirmation).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("focuses policy errors on the new password and preserves password-help association", async () => {
    render(<ResetPasswordForm />);
    await fill("onlyletters", "onlyletters");
    const password = screen.getByLabelText("New password", { exact: true });
    expect(password).toHaveFocus();
    expect(password).toHaveAttribute("aria-invalid", "true");
    const descriptions = password.getAttribute("aria-describedby")!.split(" ");
    expect(descriptions).toContain(screen.getByRole("alert").id);
    expect(descriptions.length).toBeGreaterThan(1);
  });
  it.each(["AUTH_SESSION_MISSING", "AUTH_SESSION_INVALID", "AUTH_SESSION_REVOKED"])("offers recovery continuation for %s", async code => {
    update.mockResolvedValueOnce({ ok: false, body: { code, error: "Your session has ended." } });
    render(<ResetPasswordForm returnTo="/edit" />);
    await fill("Wedding2026", "Wedding2026");
    expect(screen.getByRole("link", { name: /request a new recovery email/i })).toHaveAttribute("href", "/login?redirect=%2Fedit");
    expect(screen.getByLabelText("New password", { exact: true })).not.toHaveAttribute("aria-invalid", "true");
  });
  it("does not mistake a network failure for an expired session and supports retry", async () => {
    update.mockResolvedValueOnce({ ok: false, body: { code: "AUTH_NETWORK_ERROR", error: "Check your connection." } });
    render(<ResetPasswordForm />);
    const user = await fill("Wedding2026", "Wedding2026");
    expect(screen.getByRole("alert")).toHaveTextContent("Check your connection.");
    expect(screen.queryByRole("link", { name: /request a new recovery email/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("New password", { exact: true })).toHaveValue("Wedding2026");
    update.mockResolvedValueOnce({ ok: true, body: { updated: true } });
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(replace).toHaveBeenCalledWith("/dashboard?password=updated");
  });
});
