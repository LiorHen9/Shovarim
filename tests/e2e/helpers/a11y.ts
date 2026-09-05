import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// The automatable half of issue #41 (see docs/DECISIONS.md ADR #55).
// docs/ACCESSIBILITY.md lists eight WCAG 2.1 AA items and states plainly that no
// automated check has ever run against this app — this is the first one.
//
// Scoped to WCAG 2.1 A/AA, which is the standard the project committed to; axe's
// "best-practice" rules are deliberately excluded so a failure always means a real
// conformance gap rather than a style opinion.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Asserts the current page has no WCAG 2.1 A/AA violations.
 *
 * Automated scanning catches roughly a third of real accessibility problems — it cannot
 * judge whether alt text is meaningful or whether the focus order makes sense. The manual
 * NVDA and Lighthouse passes recorded in docs/ACCESSIBILITY.md remain necessary.
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  // Name the offending rules and elements in the failure message; the raw violation
  // objects are far too verbose to read in CI output.
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n    ${violation.nodes
        .map((node) => node.target.join(" "))
        .join("\n    ")}`,
  );

  expect(summary, `accessibility violations on ${page.url()}`).toEqual([]);
}

/**
 * Runs the same scan with the dark theme forced on.
 *
 * Phase 6.4 mounted the ThemeProvider that finally made the `.dark` token set in
 * globals.css reachable. Those tokens had never been contrast-checked in any theme, so
 * the dark palette needs its own pass rather than inheriting the light one's result.
 */
export async function expectNoA11yViolationsInDark(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: "dark" });
  try {
    await expectNoA11yViolations(page);
  } finally {
    await page.emulateMedia({ colorScheme: "light" });
  }
}
