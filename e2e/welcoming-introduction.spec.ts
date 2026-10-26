import { expect, test } from "@playwright/test";

test("the revised landing copy preserves the section structure and both themes", async ({ page }, testInfo) => {
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    if (await page.locator("html").getAttribute("data-app-theme") !== theme) await page.getByRole("switch", { name: "Dark mode", checked: theme !== "dark" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your biodata, as one link you control.");
    expect(await page.locator("main > section[id]").evaluateAll(nodes => nodes.map(node => node.id))).toEqual(["top", "why", "privacy", "samples", "how", "viewer", "trust", "beta", "questions"]);
    await expect(page.locator("#how article")).toHaveCount(4);
    await expect(page.locator("#questions details")).toHaveCount(7);
    await expect(page.locator("#top").getByRole("link", { name: "Create your introduction" })).toHaveAttribute("href", "/signup");
    await expect(page.locator("#top").getByRole("link", { name: "See an example" })).toHaveAttribute("href", "/demo");
    await expect(page.locator("#beta")).toContainText("Creating a profile for your son, daughter, or sibling? This option is coming soon.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await page.screenshot({ path: testInfo.outputPath(`welcoming-landing-${theme}.png`), animations: "disabled" });
  }
});

test("unsent interest survives close, verification back, and errors without hidden focus targets", async ({ page }, testInfo) => {
  await page.route("**/api/auth/start", route => route.fulfill({ json: { sent: true } }));
  await page.route("**/api/auth/verify", route => route.fulfill({ status: 400, json: { error: "That code has expired. Send another code." } }));
  await page.goto("/p/e2e-portfolio-token");
  const trigger = page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true });
  await trigger.click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Sign in to VivIntro" })).toHaveAttribute("href", "/login?redirect=%2Fp%2Fe2e-portfolio-token%23portfolio-interest");
  await dialog.getByRole("button", { name: "Continue as a new visitor" }).click();
  await dialog.getByLabel("Full name", { exact: true }).fill("Mira Rao");
  await dialog.getByLabel("Who are you contacting for?").selectOption("daughter");
  await dialog.getByRole("textbox", { name: "Phone number", exact: true }).fill("6175550123");
  await dialog.getByLabel("Email address", { exact: true }).fill("mira@example.test");
  const location = dialog.getByRole("group", { name: "Your location", exact: true });
  await location.getByRole("button", { name: "Enter location manually" }).click();
  await location.getByLabel("Country", { exact: true }).selectOption("US");
  await location.getByLabel("State", { exact: true }).selectOption("US-MA");
  await location.getByLabel("City", { exact: true }).fill("Quincy");
  await location.getByLabel("ZIP or PIN code", { exact: true }).fill("02171");
  await dialog.getByLabel("Candidate’s full name").fill("Anika Rao");
  await dialog.getByLabel("Family context", { exact: true }).fill("Our family values kindness, honesty and mutual respect.");
  const disclosure = dialog.locator("summary").filter({ hasText: "Add a message (optional)" });
  await expect(dialog.getByLabel("Message", { exact: true })).toBeHidden();
  await disclosure.click();
  await disclosure.focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Message", { exact: true })).toBeFocused();
  await dialog.getByLabel("Message", { exact: true }).fill("We enjoyed reading your introduction and would be happy to share more about our family.");
  await dialog.getByRole("button", { name: "Close interest form" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Candidate’s full name")).toHaveValue("Anika Rao");
  await expect(location.getByLabel("City", { exact: true })).toHaveValue("Quincy");
  await dialog.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(dialog.getByLabel("Six-digit code")).toBeFocused();
  await dialog.getByLabel("Six-digit code").fill("123456");
  await dialog.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("That code has expired");
  await expect(dialog.getByLabel("Six-digit code")).toBeFocused();
  await dialog.getByRole("button", { name: "Change details" }).click();
  await expect(dialog.getByLabel("Full name", { exact: true })).toHaveValue("Mira Rao");
  await expect(location.getByLabel("ZIP or PIN code", { exact: true })).toHaveValue("02171");
  await expect(dialog.getByLabel("Message", { exact: true })).toHaveValue(/We enjoyed/);
  await page.keyboard.press("Escape");
  await trigger.click();
  await expect(dialog.getByLabel("Full name", { exact: true })).toHaveValue("Mira Rao");
  await page.screenshot({ path: testInfo.outputPath("welcoming-interest-retained.png"), animations: "disabled" });
});
