import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`onboarding keeps edits and clear progress at ${width}px in ${theme}`, async ({ page, context }, testInfo) => {
      await context.addCookies([publishedOwnerCookie]);
      await page.setViewportSize({ width, height: width < 640 ? 740 : 900 });
      let saves = 0;
      await page.route("**/api/dashboard", async route => {
        if (route.request().method() !== "PUT") return route.continue();
        saves += 1;
        const { data } = route.request().postDataJSON();
        await route.fulfill({ json: { portfolioId: "e2e-portfolio", draftData: data } });
      });
      await page.goto("/dashboard?edit=1");
      const editor = page.getByRole("dialog", { name: "Introduction details", exact: true });
      if (theme === "dark") await editor.getByRole("button", { name: "Switch to Dark theme" }).click();
      const chooseSection = async (section: string, desktopLabel: RegExp) => {
        if (width < 1024) await editor.getByLabel("Go to introduction section").selectOption(section);
        else await editor.locator("aside").getByRole("button", { name: desktopLabel }).click();
      };
      await chooseSection("foundation", /Basics/);
      if (width < 1024) await expect(editor.locator(".dashboard-editor-mobile-step")).toContainText("Basics:");
      const name = editor.getByLabel("First name", { exact: true });
      await name.fill("");
      if (width < 640) await editor.getByRole("button", { name: "Next section", exact: true }).click();
      else await editor.getByRole("button", { name: /Continue: Personal story/ }).click();
      await expect(editor.getByRole("heading", { name: "The essentials", exact: true })).toBeVisible();
      await expect(name).toBeFocused();
      await expect(name).toHaveAttribute("aria-invalid", "true");
      await expect(editor.getByRole("alert", { name: "Check these answers" })).toContainText("First name: This field is required.");
      await page.screenshot({ path: testInfo.outputPath(`validation-${width}-${theme}.png`), animations: "disabled" });
      await name.fill("Mary");
      await name.pressSequentially(" Jane");
      await expect(name).toHaveValue("Mary Jane");
      await expect(name).toHaveAttribute("aria-invalid", "false");
      await expect.poll(() => saves).toBe(1);
      await expect(editor.getByText("Draft saved", { exact: true })).toBeVisible();
      if (width >= 640) {
        await editor.getByRole("button", { name: "Save draft", exact: true }).click();
        // Saving an already-saved revision must not repeat the database write.
        await expect(editor.getByText("Draft saved", { exact: true })).toBeVisible();
        expect(saves).toBe(1);
        await expect(editor.getByText("Draft saved", { exact: true })).toBeVisible();
      }
      await expect(editor).toBeVisible();
      await expect(name).toHaveValue("Mary Jane");
      for (const [section, label] of [
        ["foundation", /Basics/], ["story", /Personal story & lifestyle/],
        ["work", /Education & work/], ["family", /Family/],
        ["astrology", /Astrology & horoscope/], ["preferences", /Match & future/],
        ["privacy", /Appearance & contact/],
      ] as const) {
        await chooseSection(section, label);
        await expect(editor).toBeVisible();
        if (section === "work") {
          await editor.getByLabel("Highest qualification", { exact: true }).selectOption("Other");
          await editor.getByLabel("Describe your qualification").fill("Professional training");
          await expect(editor.getByLabel("Describe your qualification")).toHaveAttribute("maxlength", "100");
          await expect(editor.getByText("Draft saved", { exact: true })).toBeVisible();
        }
        if (section === "family") {
          await editor.getByLabel("Community or cultural background", { exact: true }).selectOption("Other / self-describe");
          await editor.getByLabel("Describe your community or background").fill("My cultural roots");
          await editor.getByLabel("Community or cultural background", { exact: true }).selectOption("Prefer not to say");
          await chooseSection("work", /Education & work/);
          await chooseSection("family", /Family/);
          await editor.getByLabel("Community or cultural background", { exact: true }).selectOption("Other / self-describe");
          await expect(editor.getByLabel("Describe your community or background")).toHaveValue("My cultural roots");
          await expect(editor.getByText("Draft saved", { exact: true })).toBeVisible();
          const custom = editor.getByLabel("Describe your community or background");
          await custom.scrollIntoViewIfNeeded();
          await custom.focus();
          const bounds = await custom.boundingBox();
          expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1).toBe(true);
          await page.screenshot({ path: testInfo.outputPath(`family-other-${width}-${theme}.png`), animations: "disabled" });
        }
        expect(await editor.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (width < 1024 && section !== "foundation") {
          await expect(editor.locator(".dashboard-editor-mobile-step")).not.toContainText("Basics:");
        }
        await page.screenshot({ path: testInfo.outputPath(`${section}-${width}-${theme}.png`), animations: "disabled" });
      }
      await editor.getByRole("button", { name: /^(Dashboard|Back to dashboard)$/ }).click();
      await expect(editor).toHaveCount(0);
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }
}
