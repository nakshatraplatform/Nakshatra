// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

vi.mock("thinking-orbs", () => ({
  ThinkingOrb: (props: ComponentProps<"canvas"> & { state: string; theme: string }) => (
    <canvas data-state={props.state} data-theme={props.theme} data-ink={props.color} aria-hidden={props["aria-hidden"]} />
  ),
}));

import { AppThemeProvider } from "@/components/theme/AppThemeProvider";
import { LoadingOrb, LoadingStatus } from "@/components/loading/LoadingStatus";
import { APP_THEME_STORAGE_KEY } from "@/lib/app-theme";

describe("LoadingStatus", () => {
  let themeStyles: HTMLStyleElement;
  it.each([
    ["rgb(36, 52, 67)", "light"],
    ["rgb(237, 242, 239)", "dark"],
    ["rgb(255, 253, 248)", "dark"],
  ])("uses enclosing ink %s, including inverted buttons, rather than a second palette", (color, polarity) => {
    render(<AppThemeProvider><button style={{ color }}><LoadingOrb size={20} />Saving</button></AppThemeProvider>);
    const canvas = screen.getByRole("button").querySelector("canvas");
    expect(canvas).toHaveAttribute("data-ink", color);
    expect(canvas).toHaveAttribute("data-theme", polarity);
  });

  it("keeps a public dialog's appearance independent of the app theme", () => {
    render(<AppThemeProvider><LoadingStatus compact appearance="dark" title="Sending interest" /></AppThemeProvider>);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status.querySelector("canvas")).toHaveAttribute("data-theme", "dark");
    expect(status.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(status).toHaveStyle({ colorScheme: "dark" });
  });

  beforeEach(() => {
    const browser = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
    vi.stubGlobal("localStorage", browser.localStorage);
    window.localStorage.clear();
    document.documentElement.dataset.appTheme = "light";
    // JSDOM does not load the application's global stylesheet. Model its ink
    // inheritance here; real CSS and canvas colors are covered in Playwright.
    themeStyles = document.createElement("style");
    themeStyles.textContent = `:root { color: rgb(36, 52, 67); }
      :root[data-app-theme="dark"], [data-loading-status][style*="color-scheme: dark"] { color: rgb(237, 242, 239); }
      [data-loading-status][style*="color-scheme: light"] { color: rgb(36, 52, 67); }`;
    document.head.append(themeStyles);
  });

  afterEach(() => {
    themeStyles.remove();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("explains the wait while keeping the visual orb decorative", () => {
    render(
      <AppThemeProvider>
        <LoadingStatus
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
        <LoadingStatus title="Opening your dashboard" detail="Getting your portfolio ready." />
      </AppThemeProvider>
    );

    await waitFor(() => expect(screen.getByRole("status").querySelector("canvas")).toHaveAttribute("data-theme", "dark"));
  });
});
