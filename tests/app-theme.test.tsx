// @vitest-environment jsdom

import React, { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AppThemeProvider } from "@/components/theme/AppThemeProvider";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { APP_THEME_INIT_SCRIPT, APP_THEME_STORAGE_KEY, parseAppTheme } from "@/lib/app-theme";

function mount() {
  return render(<StrictMode><AppThemeProvider><ThemeSwitch /><ThemeSwitch /></AppThemeProvider></StrictMode>);
}

describe("application theme", () => {
  beforeEach(() => {
    // Node 26 exposes an unconfigured global localStorage. Use this test's
    // actual jsdom Storage objects, not Node's unrelated experimental API.
    const browser = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
    vi.stubGlobal("localStorage", browser.localStorage);
    vi.stubGlobal("sessionStorage", browser.sessionStorage);
    window.localStorage.clear();
    document.documentElement.dataset.appTheme = "light";
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete document.documentElement.dataset.appTheme;
    vi.unstubAllGlobals();
  });

  it.each([null, undefined, "", "system", "DARK", "<script>alert(1)</script>"])("defaults unsupported preference %s to Light", (value) => {
    expect(parseAppTheme(value)).toBe("light");
  });

  it("switches all controls using keyboard, persists, and restores on remount", async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.tab();
    expect(screen.getAllByRole("button", { name: "Switch to Dark theme" })[0]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(document.documentElement.dataset.appTheme).toBe("dark");
    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getAllByRole("button", { name: "Switch to Light theme" })).toHaveLength(2);
    view.unmount();
    document.documentElement.dataset.appTheme = "light";
    mount();
    expect(screen.getAllByRole("button", { name: "Switch to Light theme" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Switch to Light theme" })[1]);
    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("light");
  });

  it("synchronizes other tabs, removal, clearing and invalid values but ignores unrelated/session storage", () => {
    mount();
    function send(key: string | null, newValue: string | null, storageArea = window.localStorage) {
      act(() => window.dispatchEvent(new StorageEvent("storage", { key, newValue, storageArea })));
    }
    send(APP_THEME_STORAGE_KEY, "dark");
    expect(document.documentElement.dataset.appTheme).toBe("dark");
    send("unrelated", "light");
    send(APP_THEME_STORAGE_KEY, "light", window.sessionStorage);
    expect(document.documentElement.dataset.appTheme).toBe("dark");
    for (const value of [null, "invalid"]) {
      send(APP_THEME_STORAGE_KEY, value);
      expect(document.documentElement.dataset.appTheme).toBe("light");
      send(APP_THEME_STORAGE_KEY, "dark");
    }
    send(null, null);
    expect(document.documentElement.dataset.appTheme).toBe("light");
  });

  it("works in memory when storage reads/writes are blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked"); });
    mount();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Switch to Dark theme" })[0]);
    expect(document.documentElement.dataset.appTheme).toBe("dark");
    await user.click(screen.getAllByRole("button", { name: "Switch to Light theme" })[0]);
    expect(document.documentElement.dataset.appTheme).toBe("light");
  });

  it("handles a blocked storage getter, including storage events", async () => {
    const storage = window.localStorage;
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Blocked"); });
    mount();
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: APP_THEME_STORAGE_KEY, newValue: "dark", storageArea: storage })));
    await userEvent.click(screen.getAllByRole("button", { name: "Switch to Dark theme" })[0]);
    expect(document.documentElement.dataset.appTheme).toBe("dark");
  });

  it("provides stable Light server markup regardless of the client's saved preference", () => {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, "dark");
    document.documentElement.dataset.appTheme = "dark";
    const html = renderToString(<AppThemeProvider><ThemeSwitch /></AppThemeProvider>);
    expect(html).toContain('aria-label="Switch to Dark theme"');
  });

  it("initializes before hydration using only allowlisted values", () => {
    for (const value of ["dark", "light", "invalid", '<script>bad()</script>']) {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, value);
      window.eval(APP_THEME_INIT_SCRIPT);
      expect(document.documentElement.dataset.appTheme).toBe(value === "dark" ? "dark" : "light");
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    window.eval(APP_THEME_INIT_SCRIPT);
    expect(document.documentElement.dataset.appTheme).toBe("light");
  });
});
