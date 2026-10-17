import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("icon navigation and floating Top stay compact without obstructing footer actions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/p/e2e-portfolio-token");
  const header = page.getByRole("banner");
  const interest = header.getByRole("link",{name:"Show Interest",exact:true});
  const menu = header.getByRole("button");
  await expect(interest).toHaveText("");
  expect((await interest.boundingBox())!.x).toBeLessThan((await menu.boundingBox())!.x);
  await menu.click();
  await expect(header.getByRole("link",{name:"Lifestyle",exact:true})).toHaveCount(0);
  await page.keyboard.press("Escape");
  const top = page.getByRole("button",{name:"Back to Top",exact:true});
  await expect(top).toHaveCount(0);
  await page.evaluate(()=>scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.4));
  await expect(top).toBeVisible();
  await top.click();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThanOrEqual(2);
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await expect(top).toHaveCount(0);
});

test("new visitor fields have usable mobile space, required context and conditional candidate controls", async ({ page },testInfo) => {
  test.setTimeout(120_000);
  for (const [width,height] of [[320,568],[375,812],[768,900],[1440,900]]) {
    await page.setViewportSize({width,height});
    await page.goto("/p/e2e-portfolio-token");
    await page.locator("#portfolio-interest").getByRole("button",{name:"Show interest",exact:true}).click();
    await page.getByRole("button",{name:"Continue as a new visitor"}).click();
    const dialog=page.getByRole("dialog");
    const scroll=dialog.locator(".interest-form-scroll");
    expect((await scroll.boundingBox())!.height).toBeGreaterThan(height*.55);
    expect((await dialog.locator(".interest-form-footer").boundingBox())!.height).toBeLessThan(90);
    await expect(dialog.getByRole("combobox",{name:"ZIP or PIN code"})).toHaveAttribute("required","");
    await dialog.getByRole("button",{name:"Enter location manually"}).click();
    await expect(dialog.getByLabel("Country",{exact:true})).toHaveAttribute("required","");
    await dialog.getByLabel("Country",{exact:true}).selectOption("US");
    await dialog.getByLabel("State",{exact:true}).selectOption("US-MA");
    await dialog.getByLabel("City",{exact:true}).fill("Boston");
    await dialog.getByLabel("ZIP or PIN code",{exact:true}).fill("02108");
    await dialog.getByLabel("Who are you contacting for?").selectOption("son");
    await expect(dialog.getByLabel("Candidate’s full name")).toHaveAttribute("required","");
    await dialog.getByLabel("Who are you contacting for?").selectOption("self");
    await expect(dialog.getByLabel("Candidate’s full name")).toBeHidden();
    await dialog.getByRole("button",{name:"Verify email and continue"}).click();
    await expect(dialog.getByLabel("Full name", { exact: true })).toBeFocused();
    await expect(dialog.getByLabel("Family context")).toHaveAttribute("aria-invalid","true");
    await expect(dialog.getByLabel("Message")).toHaveAttribute("aria-invalid","false");
    await dialog.getByText("Add a message (optional)", { exact: true }).click();
    await dialog.getByLabel("Message").scrollIntoViewIfNeeded();
    await expect(dialog.getByLabel("Message")).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if (width<=600) expect(await dialog.getByLabel("Full name", { exact: true }).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.screenshot({path:testInfo.outputPath(`interest-form-${width}.png`),animations:"disabled"});
  }
});

test("owners can reopen full retained details when shared and from history", async ({ page,context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/dashboard");
  await page.getByRole("button",{name:"View all interest submissions"}).click();
  const history=page.locator(".dashboard-interest-history");
  await expect(history.getByText("Maya Shah",{exact:true})).toBeVisible();
  await history.getByRole("button",{name:"View interest details"}).first().click();
  await expect(history.getByText("Our families have spoken once.")).toBeVisible();
  await expect(history.getByText("Email verified at",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Hide interest history"}).click();
  const stage=page.locator('[data-stage="access"]');
  const toggle = stage.locator(".dashboard-stage-toggle");
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await stage.getByRole("button",{name:/manage/i}).first().click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"View interest details"}).click();
  await expect(dialog.getByText("Our family values kindness, honesty and mutual respect.")).toBeVisible();
  await expect(dialog.getByText("Details shared at",{exact:true})).toBeVisible();
});

test("long submitted context stays readable in retained history and access dialogs", async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([publishedOwnerCookie]);
  await page.route("**/api/interest/*", async route => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.details) {
      body.details.familyContext = "x".repeat(600);
      body.details.message = "y".repeat(600);
    }
    await route.fulfill({ response, json: body });
  });
  async function expectReadable(container: ReturnType<typeof page.locator>) {
    const panel = container.locator('.dashboard-record-detail[aria-label="View interest details"]');
    await expect(panel.getByText("x".repeat(600), { exact: true })).toBeVisible();
    for (const value of ["x".repeat(600), "y".repeat(600)]) {
      const paragraph = panel.getByText(value, { exact: true });
      const bounds = await paragraph.evaluate(element => ({ width: element.getBoundingClientRect().width, scroll: element.scrollWidth, client: element.clientWidth }));
      expect(bounds.width).toBeLessThanOrEqual((await panel.boundingBox())!.width + 1);
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
    }
  }
  for (const [width, height] of [[320,568],[375,812],[768,900],[1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "View all interest submissions" }).click();
    const history = page.locator(".dashboard-interest-history");
    await history.getByRole("button", { name: "View interest details" }).first().click();
    await expectReadable(history);
    await page.getByRole("button", { name: "Hide interest history" }).click();
    const stage = page.locator('[data-stage="access"]');
    const toggle = stage.locator(".dashboard-stage-toggle");
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    await stage.getByRole("button", { name: /manage/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "View interest details" }).click();
    await expectReadable(dialog);
  }
});
