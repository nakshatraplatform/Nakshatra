// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), clearSession: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/account/client/account.api", () => ({ clearLocalAccountSession: mocks.clearSession }));
vi.mock("@/components/brand/VivIntroBrand", () => ({ VivIntroBrand: () => <a href="/dashboard">VivIntro</a> }));
vi.mock("@/components/theme/ThemeSwitch", () => ({ ThemeSwitch: () => <button type="button">Change theme</button> }));

import { CustomerAppHeader } from "../src/components/navigation/CustomerAppHeader";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clearSession.mockResolvedValue(undefined);
});

describe("customer application header", () => {
  it.each(["dashboard", "brokers", "account"] as const)("marks %s as the current customer page", (currentPage) => {
    const { container } = render(<CustomerAppHeader currentPage={currentPage} userEmail="owner@example.test" />);
    const expected = { dashboard: "Dashboard", brokers: "My brokers", account: "Account" }[currentPage];
    const navigation = screen.getByRole("navigation", { name: "Customer pages" });
    expect(navigation.querySelectorAll("a")).toHaveLength(3);
    expect(navigation.querySelector(`a[aria-current="page"]`)).toHaveTextContent(expected);
    expect(container.querySelector("details summary")).toHaveTextContent("Menu");
    expect(screen.getByRole("button", { name: "Change theme" })).toBeInTheDocument();
  });

  it("clears the local account session before returning home", async () => {
    render(<CustomerAppHeader currentPage="dashboard" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);
    await waitFor(() => expect(mocks.clearSession).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("shows a recoverable error instead of pretending sign-out succeeded", async () => {
    mocks.clearSession.mockRejectedValueOnce(new Error("offline"));
    render(<CustomerAppHeader currentPage="account" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("closes the mobile menu with Escape and returns focus to Menu", () => {
    const { container } = render(<CustomerAppHeader currentPage="brokers" />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    const summary = container.querySelector("summary") as HTMLElement;
    details.open = true;
    fireEvent.keyDown(details, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(summary).toHaveFocus();
  });
});
