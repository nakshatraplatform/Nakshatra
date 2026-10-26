// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CustomerAppFrame } from "@/components/navigation/CustomerAppFrame";
import { AppThemeProvider } from "@/components/theme/AppThemeProvider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

it("keeps the same working header while pending data resolves", async () => {
  let release!: () => void;
  let ready = false;
  const pending = new Promise<void>(resolve => { release = () => { ready = true; resolve(); }; });
  function DataRegion() {
    if (!ready) throw pending;
    return <main id="main-content">Loaded account controls</main>;
  }
  render(<AppThemeProvider><CustomerAppFrame currentPage="account" userEmail="owner@example.test" loadingTitle="Loading account controls" className="account-privacy-shell"><DataRegion /></CustomerAppFrame></AppThemeProvider>);
  const header = screen.getByRole("banner");
  expect(screen.getByRole("status")).toHaveTextContent("Loading account controls");
  screen.getByRole("main").focus();
  expect(screen.getByRole("main")).toHaveFocus();
  expect(screen.getByRole("navigation", { name: "Customer pages" }).querySelector('a[href="/dashboard"]')).not.toBeNull();
  screen.getByRole("switch", { name: "Dark mode", checked: false }).click();
  expect(document.documentElement).toHaveAttribute("data-app-theme", "dark");
  await act(async () => release());
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveTextContent("Loaded account controls");
});
