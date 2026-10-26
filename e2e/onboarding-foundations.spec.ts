import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`onboarding keeps edits and clear progress at ${width}px in ${theme}`, async ({ page, context }, testInfo) => {
      await context.addCookies([publishedOwnerCookie]);
      await page.setViewportSize({ width, height: width < 640 ? 740 : 900 });
      let saves = 0;
      const savedFirstNames: string[] = [];
      await page.route("**/api/dashboard", async route => {
        if (route.request().method() !== "PUT") return route.continue();
        saves += 1;
        const { data } = route.request().postDataJSON();
        savedFirstNames.push(data.personal.first_name);
        await route.fulfill({ json: { portfolioId: "e2e-portfolio", draftData: data } });
      });
      await page.goto("/dashboard?edit=1");
      const editor = page.getByRole("dialog", { name: "Introduction details", exact: true });
      if (theme === "dark") await editor.getByRole("switch", { name: "Dark mode", checked: false }).click();
      const chooseSection = async (section: string, desktopLabel: RegExp) => {
        if (width < 1024) await editor.getByLabel("Go to introduction section").selectOption(section);
        else await editor.locator("aside").getByRole("button", { name: desktopLabel }).click();
      };
      await chooseSection("foundation", /Basics/);
      if (width < 1024) await expect(editor.locator(".dashboard-editor-mobile-step")).toContainText("Basics:");
      const name = editor.getByLabel("First name", { exact: true });
      await name.fill("");
      const footer = editor.locator(".dashboard-editor-footer");
      await expect(footer.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
      await editor.locator(".dashboard-editor-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expect(footer.getByRole("button", { name: /Continue: Personal story/ })).toBeInViewport();
      await footer.getByRole("button", { name: /Continue: Personal story/ }).click();
      await expect(editor.getByRole("heading", { name: "The essentials", exact: true })).toBeVisible();
      await expect(name).toBeFocused();
      await expect(name).toHaveAttribute("aria-invalid", "true");
      await expect(editor.getByRole("alert", { name: "Check these answers" })).toContainText("First name: This field is required.");
      // A person may pause on validation while the incomplete draft autosaves.
      // Exercise that legitimate earlier revision before testing final-save dedup.
      if (width === 1440) await expect.poll(() => savedFirstNames.at(-1)).toBe("");
      await page.screenshot({ path: testInfo.outputPath(`validation-${width}-${theme}.png`), animations: "disabled", scale: "css" });
      await name.fill("Mary");
      await name.pressSequentially(" Jane");
      await expect(name).toHaveValue("Mary Jane");
      await expect(name).toHaveAttribute("aria-invalid", "false");
      await expect.poll(() => savedFirstNames.at(-1)).toBe("Mary Jane");
      await expect(editor.getByText("Draft saved", { exact: true })).toBeVisible();
      expect(savedFirstNames.filter(value => value === "Mary Jane")).toHaveLength(1);
      // Pure presentation changes must not trigger another saved-draft write.
      const savesBeforeTheme = saves;
      await editor.getByRole("switch", { name: "Dark mode" }).click();
      await editor.getByRole("switch", { name: "Dark mode" }).click();
      expect(saves).toBe(savesBeforeTheme);
      await expect(editor).toBeVisible();
      await expect(name).toHaveValue("Mary Jane");
      await footer.getByRole("button", { name: /Continue: Personal story/ }).click();
      await expect(editor.getByRole("heading", { name: "Personal story", exact: true })).toBeFocused();
      await footer.getByRole("button", { name: "Back", exact: true }).click();
      await expect(name).toHaveValue("Mary Jane");
      await chooseSection("story", /Personal story & lifestyle/);
      await editor.getByLabel("Languages", { exact: true }).fill("Tulu");
      // Navigate without Add: the visible text must already belong to the draft.
      await footer.getByRole("button", { name: /Continue: Education/ }).click();
      await footer.getByRole("button", { name: "Back", exact: true }).click();
      await expect(editor.getByRole("button", { name: "Remove Tulu", exact: true })).toBeVisible();
      for (const [section, label] of [
        ["foundation", /Basics/], ["story", /Personal story & lifestyle/],
        ["work", /Education & work/], ["family", /Family/],
        ["astrology", /Astrology & horoscope/], ["preferences", /Match & future/],
        ["privacy", /Appearance & contact/],
      ] as const) {
        await chooseSection(section, label);
        await expect(editor).toBeVisible();
        if (section === "work") {
          await expect(editor.getByLabel("Education location")).toHaveAccessibleDescription("City, state or region, and country where you studied.");
          await editor.getByLabel("Highest qualification", { exact: true }).selectOption("Other");
          await editor.getByLabel("Describe your qualification").fill("Professional training");
          await expect(editor.getByLabel("Describe your qualification")).toHaveAttribute("maxlength", "100");
          await expect(editor.getByText("Draft saved", { exact: true })).toBeVisible();
        }
        if (section === "astrology") {
          await expect(editor.getByText("Leave unknown details blank.")).toBeVisible();
          await expect(editor.getByText("No guessing required")).toHaveCount(0);
        }
        if (section === "privacy") {
          await expect(footer.getByRole("button", { name: "Save & review", exact: true })).toBeInViewport();
          await expect(footer.getByRole("button", { name: /^Continue:/ })).toHaveCount(0);
          await expect(editor.getByRole("group", { name: "Public sharing" })).toContainText("may be guessed");
          await expect(editor.getByRole("group", { name: "Introduction appearance" })).toContainText("not your workspace");
          for (const name of ["Light", "Dark"]) {
            const appearance = editor.getByRole("button", { name, exact: true });
            expect(await appearance.evaluate(button => [...button.querySelectorAll("svg")].every(icon => icon.getBoundingClientRect().width >= 16))).toBe(true);
            expect(await appearance.evaluate(button => button.scrollWidth <= button.clientWidth + 1)).toBe(true);
          }
          await page.screenshot({ path: testInfo.outputPath(`privacy-top-${width}-${theme}.png`), animations: "disabled", scale: "css" });
          if (width < 640) {
            const phone = editor.getByLabel("Phone number", { exact: true }).first();
            await expect(phone).toBeVisible();
            expect((await phone.boundingBox())!.width).toBeGreaterThanOrEqual(160);
          }
          const email = editor.getByLabel("Email", { exact: true }).first();
          await email.scrollIntoViewIfNeeded();
          const field = await email.boundingBox();
          const footerBounds = await editor.locator(".dashboard-editor-footer").boundingBox();
          expect(field && footerBounds && field.y + field.height <= footerBounds.y + 1).toBe(true);
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
          await page.screenshot({ path: testInfo.outputPath(`family-other-${width}-${theme}.png`), animations: "disabled", scale: "css" });
        }
        expect(await editor.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (width < 1024 && section !== "foundation") {
          await expect(editor.locator(".dashboard-editor-mobile-step")).not.toContainText("Basics:");
        }
        await page.screenshot({ path: testInfo.outputPath(`${section}-${width}-${theme}.png`), animations: "disabled", scale: "css" });
      }
      await editor.getByRole("button", { name: /^(Dashboard|Back to dashboard)$/ }).click();
      await expect(editor).toHaveCount(0);
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }
}

test("manual location entry is keyboard-visible and makes no lookup request", async ({ page, context }, testInfo) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.setViewportSize({ width: 390, height: 740 });
  let lookups = 0;
  await page.route("**/api/reference/location-suggestions", route => { lookups += 1; return route.fulfill({ json: { options: [] } }); });
  await page.goto("/dashboard?edit=1");
  const editor = page.getByRole("dialog", { name: "Introduction details", exact: true });
  await editor.getByLabel("Go to introduction section").selectOption("foundation");
  await editor.getByRole("button", { name: "Change", exact: true }).click();
  const manual = editor.getByRole("button", { name: "Enter location manually" });
  await manual.focus();
  await expect(manual).toBeFocused();
  await expect(manual).toHaveCSS("text-decoration-line", "underline");
  const bounds = await manual.boundingBox();
  expect(bounds && bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= 390).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("manual-location-action.png"), animations: "disabled" });
  await manual.press("Enter");
  await expect(editor.getByLabel("Current country", { exact: true })).toBeFocused();
  await expect(editor.getByLabel("Current city", { exact: true })).toBeVisible();
  expect(lookups).toBe(0);
});
