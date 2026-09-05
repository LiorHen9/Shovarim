/**
 * The id the skip link targets. Every route must place it on its <main> element, so it
 * lives in one constant rather than being retyped — a typo here is a silently broken
 * bypass link, which is exactly the kind of regression an automated scan does not catch.
 */
export const A11Y_MAIN_CONTENT_ID = "main-content";

/**
 * localStorage key for the accessibility toolbar's settings.
 *
 * Read twice: once by the blocking inline script in the root layout (before first paint)
 * and once by the panel when it opens. The string is duplicated into that script by
 * template literal, so this constant stays the single source of truth.
 */
export const A11Y_STORAGE_KEY = "shovarim:a11y";

/**
 * Attributes set on <html>. Everything the toolbar does is expressed as a token override
 * or a rule in globals.css keyed off one of these — no inline styles on individual
 * elements, and nothing that reaches into the DOM the way a third-party overlay widget
 * does. That is the whole reason this is built here instead of installed.
 */
export const A11Y_ATTR = {
  contrast: "data-a11y-contrast",
  links: "data-a11y-links",
  motion: "data-a11y-motion",
  focus: "data-a11y-focus",
} as const;

/** CSS custom property that scales the root font size. */
export const A11Y_FONT_SCALE_VAR = "--a11y-font-scale";

/**
 * Font scale steps. Capped at 1.5 deliberately: Tailwind sizes spacing in rem too, so the
 * whole layout grows with the text — which is what a low-vision user wants — but past 150%
 * the 4xl container starts to break down on a phone. Browser zoom remains available on top
 * of this and is explicitly not locked (see the viewport export in src/app/layout.tsx).
 */
export const A11Y_FONT_SCALES = [1, 1.15, 1.3, 1.5] as const;
