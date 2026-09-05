import { test, expect } from "@playwright/test";

import { expectNoA11yViolations } from "./helpers/a11y";

test("landing page shows sign-in options", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "שוברים" })).toBeVisible();
  await expect(page.getByRole("button", { name: "המשך עם Google" })).toBeVisible();
});

// The redirect overlay (issue #47) is gated on a pending-provider flag left in
// sessionStorage by `handleSignIn`. A visitor who never started a sign-in has
// no such flag, so the landing page must stay unblurred and interactive — the
// regression to guard against is the overlay firing for everyone.
test("landing page shows no redirect overlay for a plain visitor", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "המשך עם Google" })).toBeEnabled();
  await expect(page.getByTestId("redirect-sign-in-overlay")).toHaveCount(0);
});

test("unauthenticated user hitting a protected route is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "שוברים" })).toBeVisible();
});

test("terms and privacy pages render", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "תנאי שימוש" })).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "מדיניות פרטיות" })).toBeVisible();
});

// Before Phase 6.2 an unknown path rendered Next's default English, LTR error page.
// The smoke test in docs/DEPLOYMENT.md recorded "GET /nonexistent-route → 404 תקין",
// which was true about the status code and wrong about what the visitor actually saw.
test("an unknown path renders the Hebrew 404 page, not Next's default", async ({ page }) => {
  const response = await page.goto("/nonexistent-route");
  expect(response?.status()).toBe(404);

  await expect(page.getByRole("heading", { name: "הדף לא נמצא" })).toBeVisible();
  await expect(page.getByRole("link", { name: "חזרה לדף הבית" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("the public landing page has no WCAG 2.1 AA violations", async ({ page }) => {
  // The one page every visitor sees, and the only one reachable without a session.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "המשך עם Google" })).toBeVisible();
  await expectNoA11yViolations(page);
});

// ADR #59 turned into something enforced rather than merely written down.
//
// The reason this site needs no cookie banner is a factual claim: a visitor who has not
// signed in receives no cookie from us and is not tracked. That claim is published in
// /privacy, so the day it stops being true the published policy becomes false — and the
// change that breaks it (an analytics snippet, a marketing pixel, GA4 from ROADMAP 9.6
// layer 3) is exactly the kind that gets added without anyone rereading the policy.
//
// Two assertions, because either one alone has a hole: a tracker can load without setting
// a cookie, and a cookie can appear without a tracker.
const TRACKER_HOSTS = [
  "google-analytics.com",
  "googletagmanager.com",
  "analytics.google.com",
  "connect.facebook.net",
  "facebook.com/tr",
  "hotjar",
  "sentry.io",
];

test("a visitor who has not signed in gets no cookies and no trackers", async ({
  page,
  context,
}) => {
  const trackerRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (TRACKER_HOSTS.some((host) => url.includes(host))) trackerRequests.push(url);
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "המשך עם Google" })).toBeVisible();

  // Named in the message rather than just counted — a bare "expected 0, got 1" would send
  // the next person hunting through the whole app for which cookie appeared.
  const cookies = await context.cookies();
  expect(cookies.map((cookie) => cookie.name)).toEqual([]);
  expect(trackerRequests).toEqual([]);
});

test("the privacy policy discloses browser storage and every third-party recipient", async ({
  page,
}) => {
  await page.goto("/privacy");

  await expect(
    page.getByRole("heading", { name: "עוגיות ואחסון בדפדפן", level: 2 })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "העברת מידע לצדדים שלישיים", level: 2 })
  ).toBeVisible();

  // The three recipients data actually reaches. Meta and Anthropic were live in production
  // and undisclosed until Phase 6.C; this is what keeps them from quietly falling out of
  // the page again in a future edit.
  const main = page.getByRole("main");
  await expect(main).toContainText("Google (Firebase)");
  await expect(main).toContainText("Anthropic");
  await expect(main).toContainText("Meta");
});
