// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Link from "next/link";

const mocks = vi.hoisted(() => ({ push: vi.fn(), clearSession: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/account/client/account.api", () => ({ clearLocalAccountSession: mocks.clearSession }));
vi.mock("@/components/brand/VivIntroBrand", () => ({ VivIntroBrand: () => <Link href="/dashboard">VivIntro</Link> }));
vi.mock("@/components/theme/ThemeSwitch", () => ({ ThemeSwitch: () => <button type="button">Change theme</button> }));

import { CustomerAppHeader } from "../src/components/navigation/CustomerAppHeader";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clearSession.mockResolvedValue(undefined);
});

describe("customer application header", () => {
  function openMenu() {
    const trigger = screen.getByLabelText("Account menu");
    fireEvent.click(trigger);
    return trigger;
  }

  it.each(["dashboard", "brokers", "account"] as const)("shows %s navigation and groups account actions in the avatar", (currentPage) => {
    const { container } = render(<CustomerAppHeader currentPage={currentPage} userEmail="owner@example.test" />);
    const navigation = screen.getByRole("navigation", { name: "Customer pages" });
    expect(navigation.querySelectorAll("a")).toHaveLength(1);
    expect(navigation.querySelector('a[href="/account"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).not.toBeVisible();
    openMenu();
    expect(screen.queryByRole("link", { name: "My brokers" })).not.toBeInTheDocument();
    const settings = screen.getByRole("link", { name: "Account settings" });
    expect(settings).toHaveAttribute("href", "/account");
    if (currentPage === "account") expect(settings).toHaveAttribute("aria-current", "page");
    expect(container.querySelector("details summary")).toHaveAttribute("aria-label", "Account menu");
    expect(screen.getByRole("button", { name: "Change theme" })).toBeInTheDocument();
  });

  it("clears the session once before returning home, with pending feedback", async () => {
    let finish!: () => void;
    mocks.clearSession.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    render(<CustomerAppHeader currentPage="dashboard" />);
    openMenu();
    const button = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(button);
    await waitFor(() => expect(mocks.clearSession).toHaveBeenCalledOnce());
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Signing out");
    fireEvent.click(button);
    expect(mocks.clearSession).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  });

  it("keeps sign-out errors recoverable", async () => {
    mocks.clearSession.mockRejectedValueOnce(new Error("offline"));
    render(<CustomerAppHeader currentPage="account" />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  });

  it("closes with Escape and restores avatar focus, then dismisses on outside interaction", () => {
    const { container } = render(<CustomerAppHeader currentPage="brokers" />);
    const trigger = openMenu();
    const details = container.querySelector("details")!;
    screen.getByRole("link", { name: "Account settings" }).focus();
    fireEvent.keyDown(details, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(trigger).toHaveFocus();
    openMenu();
    fireEvent.pointerDown(document.body);
    expect(details.open).toBe(false);
    openMenu();
    fireEvent.blur(details, { relatedTarget: screen.getByRole("button", { name: "Change theme" }) });
    expect(details.open).toBe(false);
  });
});
