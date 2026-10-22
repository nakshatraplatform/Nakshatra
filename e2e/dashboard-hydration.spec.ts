import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test.use({ timezoneId: "America/Los_Angeles" });

test("editor entry waits for hydration and opens on the first enabled click", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route("**/_next/**/*.js*", async route => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/dashboard", { waitUntil: "commit" });
    const edit = page.getByRole("button", { name: "Edit details", exact: true });
    await expect(edit.first()).toBeVisible();
    for (const button of await edit.all()) await expect(button).toBeDisabled();
    releaseScripts();
    await expect(edit.first()).toBeEnabled();
    await edit.first().click();
    await expect(page.getByRole("dialog", { name: "Introduction details", exact: true })).toBeVisible();
  } finally {
    releaseScripts();
  }
});

test("dashboard hydrates request dates in a different viewer timezone", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review interests", exact: true }).click();
  await expect(page.getByText("Oct 3 · Verified email", { exact: true })).toBeVisible();
  // Interaction proves hydration completed before inspecting recoverable React errors.
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Introduction details", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
