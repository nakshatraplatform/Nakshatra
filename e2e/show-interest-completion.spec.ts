import { expect, test } from "@playwright/test";

test("visitor can complete accountless Show interest and return to a scrollable introduction", async ({ page }, testInfo) => {
  const exchanges: Array<{ action: string }> = [];
  await page.route("**/api/interest/guest", route => {
    const body = route.request().postDataJSON();
    exchanges.push(body);
    return route.fulfill({ status: body.action === "start" ? 200 : 201,
      json: body.action === "start" ? { sent: true, challengeId: "11111111-1111-4111-8111-111111111111" } : { submitted: true } });
  });

  await page.goto("/p/e2e-portfolio-token");
  await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Introduce yourself/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("interest-form.png"), animations: "disabled" });
  await dialog.getByLabel("Full name", { exact: true }).fill("ಕಾವ್ಯ ರಾವ್");
  await dialog.getByLabel("Who are you contacting for?").selectOption("self");
  await dialog.getByRole("textbox", { name: "Country calling code" }).fill("91");
  const phone = dialog.getByRole("textbox", { name: "Phone number", exact: true });
  await phone.fill("98abc7654321");
  await expect(phone).toHaveValue("987654321");
  await dialog.getByLabel("Email address").fill("viewer@example.test");
  await dialog.getByRole("button", { name: "Enter location manually" }).click();
  await dialog.getByRole("combobox", { name: "State" }).selectOption("IN-KA");
  await dialog.getByRole("textbox", { name: "City" }).fill("Bengaluru");
  const postal = dialog.getByRole("textbox", { name: "ZIP or PIN code" });
  await postal.fill("56ab0001");
  await expect(postal).toHaveValue("560001");
  await dialog.getByLabel("Family context").fill("Our family values kindness, honesty and mutual respect in every conversation.");
  await dialog.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText(/For India and the US, use 10 digits/).first()).toBeVisible();
  await phone.fill("9876543210");
  await dialog.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await dialog.getByLabel("Six-digit code").fill("123456");
  await dialog.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Interest sent", exact: true })).toBeVisible();
  expect(exchanges.map(({ action }) => action)).toEqual(["start", "complete"]);
  await dialog.getByRole("button", { name: "Return to introduction" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  const { beforeWheel, maxScroll } = await page.evaluate(() => ({ beforeWheel: window.scrollY, maxScroll: document.documentElement.scrollHeight - window.innerHeight }));
  const direction = maxScroll - beforeWheel > 100 ? 1 : -1;
  if (testInfo.project.name === "mobile-webkit") {
    // Playwright's mobile WebKit emulation has no wheel input. The restored
    // body styles above are the regression guard; scrollTo checks the viewport.
    await page.evaluate((target) => window.scrollTo(0, target), Math.max(0, Math.min(maxScroll, beforeWheel + 700 * direction)));
  } else {
    await page.mouse.move(200, 350);
    await page.mouse.wheel(0, 700 * direction);
  }
  if (direction > 0) await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeWheel);
  else await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(beforeWheel);
});

test("failed code replacement closes the stale code entry but keeps visitor details", async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install();
  let starts = 0;
  await page.route("**/api/interest/guest", route => {
    starts++;
    return route.fulfill(starts === 1
      ? { status: 200, json: { sent: true, challengeId: "11111111-1111-4111-8111-111111111111" } }
      : { status: 503, json: { error: "Email is temporarily unavailable." } });
  });
  await page.goto("/p/e2e-portfolio-token");
  await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name", { exact: true }).fill("Kavya Rao");
  await dialog.getByLabel("Who are you contacting for?").selectOption("self");
  await dialog.getByRole("textbox", { name: "Country calling code" }).fill("91");
  await dialog.getByRole("textbox", { name: "Phone number", exact: true }).fill("9876543210");
  await dialog.getByLabel("Email address").fill("viewer@example.test");
  await dialog.getByRole("button", { name: "Enter location manually" }).click();
  await dialog.getByRole("combobox", { name: "State" }).selectOption("IN-KA");
  await dialog.getByRole("textbox", { name: "City" }).fill("Bengaluru");
  await dialog.getByRole("textbox", { name: "ZIP or PIN code" }).fill("560001");
  await dialog.getByLabel("Family context").fill("Our family values kindness, honesty and mutual respect in every conversation.");
  await dialog.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.clock.runFor(61_000);
  await dialog.getByRole("button", { name: "Send another code", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: /Introduce yourself/i })).toBeVisible();
  await expect(dialog.getByText(/earlier code may no longer work/i)).toBeVisible();
  await expect(dialog.getByLabel("Full name", { exact: true })).toHaveValue("Kavya Rao");
  await expect(dialog.getByLabel("Six-digit code")).toHaveCount(0);
  expect(starts).toBe(2);
});
