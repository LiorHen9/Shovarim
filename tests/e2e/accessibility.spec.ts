import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

import { expectNoA11yViolations, expectNoA11yViolationsInDark } from "./helpers/a11y";
import { signInAsTestUser } from "./helpers/auth";

// Phase 6.A. These cover the conformance items that an axe scan structurally cannot see:
// a bypass link that exists but points nowhere, a <main> landmark that was never there,
// and page titles that are all identical. axe passes on all three.

test("the skip link is the first focusable element and jumps to the main content", async ({
  page,
}) => {
  await page.goto("/");

  // WCAG 2.4.1 requires the bypass to come before the repeated blocks, which in practice
  // means it must be first in tab order — a skip link placed after the nav is useless.
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveText("דלג לתוכן המרכזי");
  // sr-only until focused; if this fails, the focus styles were lost and a sighted
  // keyboard user has no idea what they just landed on.
  await expect(focused).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
});

test("every public page exposes a main landmark for the skip link to target", async ({
  page,
}) => {
  for (const path of ["/", "/privacy", "/terms", "/accessibility", "/nonexistent-route"]) {
    await page.goto(path);
    await expect(page.locator("main#main-content")).toHaveCount(1);
  }
});

// The signed-in area wrapped its content in a plain <div> until Phase 6.A — so every
// protected page, which is most of the app, had no main landmark at all.
test("the signed-in area exposes a main landmark", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await expect(page.locator("main#main-content")).toHaveCount(1);
  await page.goto("/cards");
  await expect(page.locator("main#main-content")).toHaveCount(1);
});

// WCAG 2.4.2 (Level A). Every route used to render the title "שוברים"; axe's
// document-title rule only checks that a title exists and is non-empty.
test("public pages have distinct, descriptive titles", async ({ page }) => {
  const expected: Record<string, string> = {
    "/": "שוברים",
    "/privacy": "מדיניות פרטיות · שוברים",
    "/terms": "תנאי שימוש · שוברים",
    "/accessibility": "הצהרת נגישות · שוברים",
  };

  for (const [path, title] of Object.entries(expected)) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }
});

test("signed-in pages have distinct, descriptive titles", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await expect(page).toHaveTitle("ראשי · שוברים");
  await page.goto("/cards");
  await expect(page).toHaveTitle("הכרטיסים שלי · שוברים");
  await page.goto("/settings");
  await expect(page).toHaveTitle("הגדרות · שוברים");
});

// The statement has to be findable from anywhere, not only from the page that links it.
test("the accessibility statement is reachable from the footer on every page", async ({
  page,
}) => {
  for (const path of ["/", "/privacy", "/nonexistent-route"]) {
    await page.goto(path);
    await expect(
      page.getByRole("navigation", { name: "קישורים משפטיים" }).getByRole("link", {
        name: "הצהרת נגישות",
      }),
    ).toBeVisible();
  }

  await page.goto("/");
  await page
    .getByRole("navigation", { name: "קישורים משפטיים" })
    .getByRole("link", { name: "הצהרת נגישות" })
    .click();
  await expect(page).toHaveURL(/\/accessibility$/);
  await expect(page.getByRole("heading", { name: "הצהרת נגישות" })).toBeVisible();
});

// All three legal pages, not just the statement: they gained a banner landmark and a
// second navigation landmark when (legal)/layout.tsx started rendering the header, and
// only /accessibility had ever been scanned.
test("the legal pages have no WCAG 2.1 AA violations, in either theme", async ({ page }) => {
  const pages: [path: string, heading: string][] = [
    ["/accessibility", "הצהרת נגישות"],
    ["/privacy", "מדיניות פרטיות"],
    ["/terms", "תנאי שימוש"],
  ];

  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoA11yViolationsInDark(page);
  }
});

test("the accessibility toolbar scales the root font size and persists the choice", async ({
  page,
}) => {
  await page.goto("/");
  const rootFontSize = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

  expect(await rootFontSize()).toBe("16px");

  await page.getByRole("button", { name: "הגדרות נגישות" }).click();
  await page.getByText("130%", { exact: true }).click();
  expect(await rootFontSize()).toBe("20.8px");

  // The point of persisting it is that a low-vision user should not have to set it again
  // on every visit — and the inline script must apply it before the first paint.
  await page.reload();
  expect(await rootFontSize()).toBe("20.8px");
});

test("the accessibility toolbar toggles high contrast and resets cleanly", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");

  await page.getByRole("button", { name: "הגדרות נגישות" }).click();
  await page.getByRole("checkbox", { name: "ניגודיות גבוהה" }).check();
  await expect(html).toHaveAttribute("data-a11y-contrast", "high");

  await page.getByRole("checkbox", { name: "הדגשת קישורים" }).check();
  await expect(html).toHaveAttribute("data-a11y-links", "underline");

  await page.reload();
  await expect(html).toHaveAttribute("data-a11y-contrast", "high");

  await page.getByRole("button", { name: "הגדרות נגישות" }).click();
  await page.getByRole("button", { name: "איפוס" }).click();
  await expect(html).not.toHaveAttribute("data-a11y-contrast", /.*/);
  await expect(html).not.toHaveAttribute("data-a11y-links", /.*/);
});

// The toolbar is the one component in the app that has no excuse for a violation.
test("the open accessibility toolbar itself has no WCAG 2.1 AA violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "הגדרות נגישות" }).click();
  await expect(page.getByRole("radio", { name: "150%" })).toHaveCount(1);
  await expectNoA11yViolations(page);
  await expectNoA11yViolationsInDark(page);
});

// High contrast overrides the token set that both themes are built from, so it needs its
// own contrast pass in each — the override could easily be complete in light and partial
// in dark, which is exactly what happened to the dark palette before Phase 6.4.
test("high contrast mode has no WCAG 2.1 AA violations, in either theme", async ({ page }) => {
  await page.goto("/accessibility");
  await page.getByRole("button", { name: "הגדרות נגישות" }).click();
  await page.getByRole("checkbox", { name: "ניגודיות גבוהה" }).check();
  await page.keyboard.press("Escape");

  await expectNoA11yViolations(page);
  await expectNoA11yViolationsInDark(page);
});

// Phase 6.4 scanned two pages: the landing page and the dashboard. Everything else in the
// app — including the card form, which is where most of the form semantics live — had
// never been scanned at all. One sign-in, then walk the routes.
test("the remaining signed-in routes have no WCAG 2.1 AA violations", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  // The second entry is a locator that must be settled before scanning. The h1 alone is
  // not enough: on /settings it renders immediately while the channel list is still
  // loading, and the refresh button is `disabled` (so `opacity-50`) for as long as it is.
  // axe measured that blended colour at 3.69:1 and reported a violation — but WCAG 1.4.3
  // exempts inactive components outright, so the finding was an artefact of scanning a
  // transient state, not something to "fix" in the palette.
  const routes: [path: string, heading: string, settled?: string][] = [
    ["/cards", "הכרטיסים שלי"],
    ["/cards/new", "כרטיס חדש"],
    ["/settings", "הגדרות", "טוען ערוצים מקושרים…"],
    ["/chat", "צ'אט"],
  ];

  for (const [path, heading, settled] of routes) {
    await page.goto(path);
    // Wait on the heading rather than a network-idle guess: these pages render their own
    // skeleton first, and axe would otherwise scan the skeleton.
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    if (settled) await expect(page.getByText(settled)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await expectNoA11yViolationsInDark(page);
  }
});

// Phase 6.B. The legal pages had no header at all, so the footer link Phase 6.A added to
// make the statement reachable from everywhere dropped the visitor onto a dead end.
test("the legal pages carry a header that stays put while scrolling", async ({ page }) => {
  for (const path of ["/accessibility", "/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.getByRole("banner")).toBeVisible();
  }

  // The accessibility statement is the longest of the three, so it is the one that
  // actually scrolls far enough for "sticky" to mean anything.
  await page.goto("/accessibility");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await page.getByRole("banner").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(1);
});

test("a signed-out visitor to a legal page gets a sign-in link, not the app nav", async ({
  page,
}) => {
  await page.goto("/privacy");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "התחברות" })).toBeVisible();
  await expect(header.getByRole("link", { name: "כרטיסים" })).toHaveCount(0);
});

// The regression this phase exists for: reaching /privacy from the footer used to leave a
// signed-in user with no route back into the app.
test("a signed-in visitor can navigate out of a legal page", async ({ page }) => {
  const uid = `e2e-${randomUUID()}`;
  await signInAsTestUser(page, { uid, email: `${uid}@example.com`, name: "בודק אוטומטי" });

  await page.goto("/privacy");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "התחברות" })).toHaveCount(0);
  await header.getByRole("link", { name: "כרטיסים" }).click();
  await expect(page).toHaveURL(/\/cards$/);
});

test("the accessibility toolbar is centred on the vertical axis and opens inside the viewport", async ({
  page,
}) => {
  await page.goto("/");
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const trigger = page.getByRole("button", { name: "הגדרות נגישות" });
  const button = await trigger.boundingBox();
  expect(button).not.toBeNull();
  expect(Math.abs(button!.y + button!.height / 2 - viewport!.height / 2)).toBeLessThan(2);

  // The panel opens along the inline axis rather than downward precisely so that a
  // vertically centred trigger does not push it off-screen.
  await trigger.click();
  const panel = await page.getByRole("dialog", { name: "הגדרות נגישות" }).boundingBox();
  expect(panel).not.toBeNull();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.y).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(viewport!.width);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(viewport!.height);
});
