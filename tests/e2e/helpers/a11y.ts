import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// The automatable half of issue #41 (see docs/DECISIONS.md ADR #55), extended in Phase 6.A
// from two pages to every route in the app.
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
  //
  // The target selector alone is not actionable: a Tailwind class chain does not identify
  // the element, and for color-contrast it does not say what the measured ratio was. axe's
  // own failureSummary carries the computed colours and ratio, so a trimmed version of it
  // is included — that is what turned the first cross-route failure from a guess into a
  // one-line fix.
  const summary = results.violations.map((violation) => {
    const nodes = violation.nodes.map(
      (node) =>
        `${node.target.join(" ")}\n      ${node.html.slice(0, 160)}\n      ${(
          node.failureSummary ?? ""
        )
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join(" | ")}`,
    );
    return `${violation.id} (${violation.impact}): ${violation.help}\n    ${nodes.join("\n    ")}`;
  });

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
