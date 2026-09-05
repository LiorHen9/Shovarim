import { A11Y_MAIN_CONTENT_ID } from "@/lib/a11y/constants";

/**
 * "Skip to main content" — WCAG 2.4.1 Bypass Blocks (Level A).
 *
 * The app had no bypass mechanism at all. The axe scans added in Phase 6.4 passed only
 * because axe's `bypass` rule accepts a heading structure as sufficient; a keyboard or
 * screen-reader user still had to tab through the header nav and the user menu on every
 * single page. Under ת"י 5568 this is a real conformance item, not a nicety.
 *
 * Must be the first focusable element in the document, so it is mounted at the very top
 * of <body> in the root layout rather than inside either route group.
 *
 * Visible only on focus: `sr-only` keeps it out of the visual flow, `focus:not-sr-only`
 * restores it. `start-2` (not `left-2`) so it lands on the correct side under dir="rtl".
 */
export function SkipLink() {
  return (
    <a
      href={`#${A11Y_MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
    >
      דלג לתוכן המרכזי
    </a>
  );
}
