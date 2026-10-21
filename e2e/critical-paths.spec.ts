import { expect, test } from "@playwright/test";

test("landing page presents the product and reaches open account creation", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Vivara: your personal page for marriage | VivIntro");
  await expect(page.getByRole("heading", { name: /share your story before you share your number/i })).toBeVisible();
  const primaryCta = page.getByRole("main").getByRole("link", { name: /create your vivara/i }).first();
  await expect(primaryCta).toHaveAttribute("href", "/signup");
  await page.goto("/waitlist");
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up with Google" })).toBeEnabled();
});

test("sign-in form preserves a safe post-auth destination", async ({ page }) => {
  await page.goto("/login?redirect=%2Fedit");
  await expect(page.getByRole("heading", { name: /sign in to VivIntro/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await page.getByLabel("Email address").fill("person@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Wedding2026");
  await expect(page.getByLabel("Email address")).toHaveValue("person@example.com");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("Wedding2026");
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();

  const viewport = await page.evaluate(() => ({
    height: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight,
  }));
  expect(viewport.pageHeight).toBeLessThanOrEqual(viewport.height + 1);
});

test("BrokerDesk reuses account creation with clear private-workspace guidance", async ({ page }) => {
  await page.goto("/signup?redirect=%2Fbrokerdesk%2Fonboarding");
  await expect(page.getByRole("heading", { name: "Create your broker account" })).toBeVisible();
  await expect(page.getByText(/workspace stays private/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login?redirect=%2Fbrokerdesk%2Fonboarding"
  );
});

test("unauthenticated owners are redirected away from protected screens", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: /sign in to VivIntro/i })).toBeVisible();

  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?redirect=%2Faccount/);
  await expect(page.getByRole("heading", { name: /sign in to VivIntro/i })).toBeVisible();
});

test("landing page remains usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /create your vivara/i }).first()).toBeVisible();
  await expect(page.locator("#top").getByRole("link", { name: /see a sample vivara/i })).toBeVisible();
});

test("landing concepts keep the same clear path to signup", async ({ page }) => {
  const concepts = [
    ["/landing/control", /your vivara\. private details shared by your decision/i],
    ["/landing/story", /let someone get to know the person behind the details/i],
  ] as const;

  for (const [path, heading] of concepts) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /create your vivara/i }).first()).toHaveAttribute(
      "href",
      "/signup"
    );
  }
});

test("public portfolio renders sanitized data and adaptive media", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");

  await expect(page.getByRole("heading", { name: "Aditi Rao" })).toBeVisible();
  const verifiedBadge = page.getByLabel(/Liveness checked\. A live person/);
  await expect(verifiedBadge).toBeVisible();
  await expect(verifiedBadge).toHaveAttribute(
    "aria-label",
    /does not verify legal identity, introduction photo ownership, profile statements, or endorse a match/
  );
  await expect(page.getByText(/Family information exists and can be requested/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "More can be shared privately." })).toBeVisible();
  await expect(page.getByText("Direct contact", { exact: true })).toBeVisible();
  await expect(page.getByText("Ramesh Rao", { exact: true })).toHaveCount(0);
  await expect(page.getByText("family@example.com", { exact: true })).toHaveCount(0);
  const interestButton = page.getByRole("button", { name: "Show interest" });
  await expect(interestButton).toBeVisible();
  await interestButton.click();

  const viewerChoiceDialog = page.getByRole("dialog", { name: /how would you like to continue/i });
  await expect(viewerChoiceDialog).toBeVisible();
  const googleContinuation = viewerChoiceDialog.getByRole("button", { name: "Continue with Google" });
  await expect(googleContinuation).toBeVisible();
  await expect(viewerChoiceDialog.getByRole("link", { name: "Sign in to VivIntro" })).toHaveCSS("background-color", "rgb(35, 75, 104)");
  await viewerChoiceDialog.getByRole("button", { name: "Continue as a new visitor" }).click();

  const interestDialog = page.getByRole("dialog", { name: /introduce yourself/i });
  await expect(interestDialog).toBeVisible();
  await expect(interestDialog.getByLabel("Full name", { exact: true })).toHaveValue("");
  await expect(interestDialog.getByLabel("Who are you contacting for?")).toHaveValue("");
  await expect(interestDialog.getByLabel("Phone number")).toHaveValue("");
  await expect(interestDialog.getByLabel("Email address")).toHaveValue("");
  await interestDialog.getByRole("button", { name: "Close interest form" }).click();

  const hero = page.locator('.portfolio-hero-media[data-orientation="portrait"]');
  await expect(hero).toBeVisible();
  await expect(hero.getByAltText("Public portrait")).toBeVisible();
  await expect.poll(() => hero.getByAltText("Public portrait").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect
    .poll(async () => {
      const bounds = await page.locator(".portfolio-primary-photo").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

      if (bounds.height === 0) return null;
      return Number((bounds.width / bounds.height).toFixed(2));
    })
    .toBe(0.75);
  const gallery = page.locator(".portfolio-gallery");
  await expect(gallery.locator('.portfolio-gallery-feature img[data-orientation="portrait"]')).toBeVisible();
  await expect(
    gallery.locator(".portfolio-gallery-feature").getByAltText("Public portrait", { exact: true })
  ).toBeVisible();
  await gallery.getByRole("button", { name: "Show photo 2" }).click();
  await expect(gallery.locator('.portfolio-gallery-feature img[data-orientation="landscape"]')).toBeVisible();
  await expect(
    gallery.locator(".portfolio-gallery-feature").getByAltText("Public landscape", { exact: true })
  ).toBeVisible();
  await expect(gallery.locator(".portfolio-gallery-thumbnail")).toHaveCount(8);
  await expect(gallery.locator('.portfolio-gallery-thumbnail:not([data-presentation="blurred"])')).toHaveCount(7);
  await expect(gallery.locator('.portfolio-gallery-thumbnail[data-presentation="blurred"]')).toHaveCount(1);
  await expect(gallery.getByRole("button", { name: "Show photo 1" })).toBeVisible();
  await expect(gallery.getByRole("button", { name: "Photo 8, shared privately" })).toBeVisible();
  await expect(gallery.getByAltText("Protected portrait")).toHaveCount(0);
  const galleryColumns = await gallery.locator(".portfolio-gallery-viewer").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length
  );
  expect(galleryColumns).toBe((page.viewportSize()?.width || 0) <= 720 ? 1 : 2);
  const galleryBeforePreferences = await gallery.evaluate((galleryElement) => {
    const preferences = document.querySelector("#preferences");
    return Boolean(preferences && (galleryElement.compareDocumentPosition(preferences) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(galleryBeforePreferences).toBe(true);
  await expect(page.locator("#preferences")).toBeVisible();
  await expect(page.locator("#shared-life")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show next photo" })).toHaveCount(0);
});

test("public portfolio exposes production-ready metadata and distinct accent roles", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "http://127.0.0.1:3100/p/e2e-portfolio-token/opengraph-image"
  );

  const portfolio = page.locator(".portfolio-root:visible");
  await expect(portfolio).toBeVisible();
  const accents = await portfolio.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.getPropertyValue("--portfolio-background").trim(),
      primary: styles.getPropertyValue("--portfolio-primary").trim(),
      teal: styles.getPropertyValue("--portfolio-teal").trim(),
      gold: styles.getPropertyValue("--portfolio-gold").trim(),
    };
  });
  expect(accents).toEqual({
    background: "#f7f5ef",
    primary: "#1c2936",
    teal: "#1c2936",
    gold: "#80551c",
  });
  expect(accents.gold).not.toBe(accents.primary);

  const privacyControl = page.getByRole("banner").getByRole("link", { name: "VivIntro home — opens in a new tab", exact: true });
  await expect(privacyControl).toBeVisible();
  await expect(privacyControl).toHaveAttribute("href", "/");
  await privacyControl.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(privacyControl).toBeFocused();
  await expect(privacyControl).toHaveCSS("outline-width", "3px");
  await expect(page.locator(".portfolio-long-copy").first()).toHaveCSS("overflow-wrap", "anywhere");

  if ((page.viewportSize()?.width || 0) > 720) {
    const chapterStyles = await page.locator(".portfolio-chapter").first().evaluate((element) => {
      const styles = getComputedStyle(element);
      return { display: styles.display, columns: styles.gridTemplateColumns.split(" ").length };
    });
    expect(chapterStyles).toEqual({ display: "grid", columns: 2 });

    const pairedStyles = await page.locator(".portfolio-chapter-pair").first().evaluate((element) => {
      const styles = getComputedStyle(element);
      return { display: styles.display, columns: styles.gridTemplateColumns.split(" ").length };
    });
    expect(pairedStyles).toEqual({ display: "grid", columns: 2 });
    await expect(page.locator(".portfolio-chapter-pair")).toHaveCount(2);

    const futureChapterStyles = await page.locator("#preferences, #shared-life").evaluateAll((elements) =>
      elements.map((element) => {
        const styles = getComputedStyle(element);
        const copy = element.querySelector(".portfolio-long-copy");
        return {
          display: styles.display,
          columns: styles.gridTemplateColumns.split(" ").length,
          copySize: copy ? Number.parseFloat(getComputedStyle(copy).fontSize) : 0,
        };
      })
    );
    expect(futureChapterStyles).toEqual([
      { display: "grid", columns: 2, copySize: 18 },
      { display: "grid", columns: 2, copySize: 18 },
    ]);
  } else {
    await expect(page.locator(".portfolio-chapter-pair").first()).toHaveCSS("display", "block");
    const futureChapterStyles = await page.locator("#preferences, #shared-life").evaluateAll((elements) =>
      elements.map((element) => ({
        display: getComputedStyle(element).display,
        columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      }))
    );
    expect(futureChapterStyles).toEqual([
      { display: "grid", columns: 1 },
      { display: "grid", columns: 1 },
    ]);
  }
});

test("interest popup stays in view and requires decision-making details", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");
  await page.getByRole("button", { name: "Show interest" }).click();

  const viewerChoiceDialog = page.getByRole("dialog", { name: /how would you like to continue/i });
  await expect(viewerChoiceDialog).toBeVisible();
  await viewerChoiceDialog.getByRole("button", { name: "Continue as a new visitor" }).click();

  const dialog = page.getByRole("dialog", { name: /introduce yourself/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Full name", { exact: true })).toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Who are you contacting for?")).toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Phone number")).toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Email address")).toHaveAttribute("required", "");

  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewport: window.innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport + 1);

  await expect(dialog.getByRole("combobox", { name: "ZIP or PIN code" })).toHaveAttribute("required", "");
  await dialog.getByRole("button", { name: "Enter location manually" }).click();
  for (const name of ["Country", "State", "City", "ZIP or PIN code", "Family context"]) await expect(dialog.getByLabel(name, { exact: true })).toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Message", { exact: true })).not.toHaveAttribute("required", "");
  const formSpace = await dialog.locator(".interest-form-scroll").boundingBox();
  expect(formSpace!.height).toBeGreaterThan(bounds.viewport * 0.55);
  await expect(dialog.getByRole("button", { name: "Verify email and continue" })).toBeInViewport();
});

test("Private portfolio keeps one gallery photo clear and shows protected placeholders", async ({ page }) => {
  await page.goto("/p/e2e-private-token");

  await expect(page.locator('.portfolio-root[data-privacy-mode="private"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "A little more about Aditi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Education and career" })).toHaveCount(0);
  const gallery = page.locator(".portfolio-gallery");
  await expect(gallery.locator(".portfolio-gallery-thumbnail")).toHaveCount(8);
  await expect(gallery.locator('.portfolio-gallery-thumbnail:not([data-presentation="blurred"])')).toHaveCount(2);
  await expect(gallery.locator('.portfolio-gallery-thumbnail[data-presentation="blurred"]')).toHaveCount(6);
  await expect(gallery.getByAltText("Public portrait", { exact: true })).toBeVisible();
  await expect(gallery.locator('.portfolio-gallery-feature[data-presentation="clear"]')).toBeVisible();
});

test("gallery photo viewer closes from the backdrop on touch and restores the opener", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");
  const opener = page.locator(".portfolio-gallery-open");
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Gallery photo viewer" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close photo and return to gallery" })).toBeFocused();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  if (page.context().browser()?.browserType().name() === "chromium" && page.viewportSize()!.width <= 720) {
    await page.touchscreen.tap(bounds!.x + 4, bounds!.y + bounds!.height / 2);
  } else {
    await page.mouse.click(bounds!.x + 4, bounds!.y + bounds!.height / 2);
  }
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("portfolio navigation, help links, and return-to-top work at each viewport", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");
  const footer = page.getByRole("navigation", { name: "Portfolio help and policies" });
  await expect(page.locator("footer > div").first()).toHaveCSS("display", "grid");
  const helpLinks = footer.getByRole("link");
  await expect(helpLinks).toHaveCount(4);
  await expect(footer.getByRole("link", { name: "Report or correct information" })).toBeVisible();
  const viewportWidth = page.viewportSize()!.width;
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  if (viewportWidth >= 1200) {
    const linkTops = await helpLinks.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
    expect(new Set(linkTops).size).toBe(1);
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const backToTop = page.getByRole("link", { name: "Back to top", exact: true });
  await expect(backToTop).toBeVisible();
  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("portfolio actions and hero remain usable across supported viewports", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");

  const viewportWidth = page.viewportSize()?.width || 0;
  const hero = page.locator(".portfolio-photo-stage");
  await expect(hero).toBeVisible();
  const heroBounds = await hero.boundingBox();
  expect(heroBounds).not.toBeNull();

  if (viewportWidth <= 720) {
    expect(heroBounds!.height).toBeLessThanOrEqual(370);
  }

  await expect(page.locator(".portfolio-mobile-interest")).toHaveCount(0);
  await expect(page.locator(".portfolio-hero-actions")).toHaveCount(0);

  const headerAction = page.getByRole("banner").getByRole("link", { name: "Show Interest", exact: true });
  await expect(headerAction).toBeVisible();
  await expect(headerAction).toHaveAttribute("aria-label", "Show Interest");
  await expect(headerAction).toHaveText("");
  await expect(headerAction).toHaveAttribute("href", "#portfolio-interest");
  expect((await headerAction.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator("#portfolio-interest").getByRole("button", { name: "Show interest" })).toBeVisible();
});
