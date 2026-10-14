import { expect, test } from "@playwright/test";

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
