import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("profile fields retain invalid input, explain corrections and accept Unicode names", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.route("**/api/dashboard", async route => {
    if (route.request().method() !== "PUT") return route.continue();
    const { data } = route.request().postDataJSON();
    await route.fulfill({ json: { portfolioId: "e2e-portfolio", draftData: data } });
  });
  await page.goto("/dashboard?edit=1");
  const editor = page.getByRole("dialog", { name: "Introduction details", exact: true });
  const section = editor.getByLabel("Go to introduction section");
  if (await section.isVisible()) await section.selectOption("foundation");
  else await editor.locator("aside").getByRole("button", { name: /Basics/ }).click();

  const name = editor.getByLabel("First name", { exact: true });
  await name.fill("Ananya123");
  await name.press("Tab");
  await expect(name).toHaveValue("Ananya123");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAccessibleDescription(/Use letters/);
  await name.fill("ಅನನ್ಯ");
  await name.press("Tab");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  expect(await name.evaluate(input => (input as HTMLInputElement).checkValidity())).toBe(true);

  for (const [label, valid] of [["Current profession title", "3D artist"], ["Short description", "I enjoy 5K runs."]] as const) {
    const field = editor.getByLabel(label, { exact: true });
    await field.fill("12345");
    await field.press("Tab");
    await expect(field).toHaveValue("12345");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(/Include at least one letter/);
    await field.fill(valid);
    await expect(field).toHaveAttribute("aria-invalid", "false");
  }

  await editor.getByRole("button", { name: "Change", exact: true }).click();
  await editor.getByRole("button", { name: "Enter location manually" }).click();
  const city = editor.getByLabel("Current city", { exact: true });
  await city.fill("12345");
  await city.press("Tab");
  await expect(city).toHaveAttribute("aria-invalid", "true");
  await expect(city).toHaveAccessibleDescription(/Include at least one letter/);
  await city.fill("Sector 7");
  await expect(city).toHaveAttribute("aria-invalid", "false");
});
