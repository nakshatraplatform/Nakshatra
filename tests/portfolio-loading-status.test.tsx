// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

vi.mock("thinking-orbs", () => ({
  ThinkingOrb: (props: ComponentProps<"canvas"> & { state: string; theme: string }) => (
    <canvas data-state={props.state} data-theme={props.theme} aria-hidden={props["aria-hidden"]} />
  ),
}));

import { AppThemeProvider } from "@/components/theme/AppThemeProvider";
import { PortfolioLoadingStatus } from "@/components/loading/PortfolioLoadingStatus";
import { APP_THEME_STORAGE_KEY } from "@/lib/app-theme";

describe("PortfolioLoadingStatus", () => {
  beforeEach(() => {
    const browser = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
    vi.stubGlobal("localStorage", browser.localStorage);
    window.localStorage.clear();
    document.documentElement.dataset.appTheme = "light";
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("explains the wait while keeping the visual orb decorative", () => {
    render(
      <AppThemeProvider>
        <PortfolioLoadingStatus
          title="Publishing your portfolio"
          detail="Keep this page open until the result appears."
          state="weaving"
        />
      </AppThemeProvider>
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Publishing your portfolio");
    expect(status).toHaveTextContent("Keep this page open until the result appears.");
    expect(status.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(status.querySelector("canvas")).toHaveAttribute("data-state", "weaving");
  });

  it("uses the stored VivIntro theme instead of the device appearance", async () => {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, "dark");
    render(
      <AppThemeProvider>
        <PortfolioLoadingStatus title="Opening your dashboard" detail="Getting your portfolio ready." />
      </AppThemeProvider>
    );

    await waitFor(() => expect(screen.getByRole("status").querySelector("canvas")).toHaveAttribute("data-theme", "dark"));
  });
});
