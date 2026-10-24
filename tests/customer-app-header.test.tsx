// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("keeps a touch-opened menu actionable when blur has no next focus target", async () => {
    const { container } = render(<CustomerAppHeader currentPage="dashboard" />);
    const trigger = openMenu();
    trigger.focus();
    // Touch browsers may blur summary without focusing the tapped button.
    fireEvent.blur(trigger, { relatedTarget: null });
    expect(container.querySelector("details")!.open).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.clearSession).toHaveBeenCalledOnce());
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


it("shows the account holder's first and last name after identity loads without blocking actions", async () => {
  let resolve!: (value: { firstName: string; middleName: string; lastName: string }) => void;
  const profile = new Promise<{ firstName: string; middleName: string; lastName: string }>(done => { resolve = done; });
  await act(async () => { render(<CustomerAppHeader currentPage="dashboard" userEmail="owner@example.test" accountProfile={profile} />); });
  expect(screen.getByRole("button", { name: "Change theme" })).toBeEnabled();
  fireEvent.click(screen.getByLabelText("Account menu"));
  expect(screen.getByRole("link", { name: "Account settings" })).toBeVisible();
  await act(async () => resolve({ firstName: "Mary Jane", middleName: "Anne", lastName: "Rao" }));
  expect(await screen.findAllByText("Mary Jane Rao")).toHaveLength(2);
  expect(screen.queryByText("Your account")).not.toBeInTheDocument();
  expect(screen.getAllByText("MR")).toHaveLength(2);
});

it("keeps complete long names in the account identity and uses Unicode initials", async () => {
  const firstName = `Élodie ${"a".repeat(70)}`;
  const lastName = `李${"b".repeat(79)}`;
  await act(async () => {
    render(<CustomerAppHeader currentPage="dashboard" accountProfile={Promise.resolve({ firstName, middleName: "", lastName })} />);
  });
  fireEvent.click(screen.getByLabelText("Account menu"));
  expect(await screen.findAllByText(`${firstName} ${lastName}`)).toHaveLength(2);
  expect(screen.getAllByText("É李")).toHaveLength(2);
});
