import { expect, test } from "@playwright/test";

test("dashboard action text retains contrast at the instant a theme changes", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Switch to Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await page.getByRole("button", { name: "Switch to Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "light");
  // Independent consumer DOM checks the real shared stylesheet, not an account action.
  await page.evaluate(() => {
    const workspace = document.createElement("section");
    workspace.className = "dashboard-shell";
    for (const action of ["primary", "secondary", "danger"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dashboard-${action}-action`;
      button.textContent = `Contrast probe ${action}`;
      workspace.append(button);
    }
    document.body.append(workspace);
  });
  for (const theme of ["dark", "light"]) {
    const measurements = await page.evaluate(theme => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[class^="dashboard-"]')];
      // Flush the old styles so this also catches a background-only cross-fade.
      for (const button of buttons) getComputedStyle(button).getPropertyValue("background-color");
      document.querySelector<HTMLButtonElement>(`button[aria-label="Switch to ${theme === "dark" ? "Dark" : "Light"} theme"]`)!.click();
      const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = color.startsWith("color(srgb ") ? value : value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      return buttons.map(button => {
        const style = getComputedStyle(button);
        let surface: Element = button;
        while (getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)" && surface.parentElement) surface = surface.parentElement;
        const background = getComputedStyle(surface).backgroundColor;
        const a = luminance(style.color), b = luminance(background);
        return { action: button.className, foreground: style.color, background,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
    }, theme);
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
    for (const measurement of measurements) {
      expect(measurement.ratio, `${theme}: ${JSON.stringify(measurement)}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("OTP resend notice retains readable contrast in both app themes", async ({ page }) => {
  await page.goto("/login");
  // Complete a real client interaction before adding the independent CSS fixture.
  await page.getByRole("button", { name: "Switch to Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await page.getByRole("button", { name: "Switch to Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "light");
  // Isolated consumer-DOM fixture: checks the real stylesheet cascade, not email delivery.
  await page.evaluate(() => {
    const panel = document.createElement("section");
    panel.className = "interest-verification";
    const notice = document.createElement("p");
    notice.className = "interest-verification-notice";
    notice.textContent = "A new code has been sent. Please check your email.";
    panel.append(notice);
    document.body.append(panel);
  });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "Switch to Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
    const ratio = await page.locator(".interest-verification-notice").evaluate(element => {
      const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const style = getComputedStyle(element);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});
