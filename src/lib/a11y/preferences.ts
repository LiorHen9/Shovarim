import {
  A11Y_ATTR,
  A11Y_FONT_SCALE_VAR,
  A11Y_FONT_SCALES,
  A11Y_STORAGE_KEY,
} from "./constants";

export type A11yPreferences = {
  fontScale: number;
  highContrast: boolean;
  underlineLinks: boolean;
  enhancedFocus: boolean;
  reduceMotion: boolean;
};

export const A11Y_DEFAULTS: A11yPreferences = {
  fontScale: 1,
  highContrast: false,
  underlineLinks: false,
  enhancedFocus: false,
  reduceMotion: false,
};

/**
 * Tolerant parse. Anything unrecognised falls back to the default rather than throwing:
 * a corrupt or stale value in localStorage must never be able to break the page, and this
 * runs before first paint.
 */
export function parseA11yPreferences(raw: string | null): A11yPreferences {
  if (!raw) return A11Y_DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return A11Y_DEFAULTS;
    const value = parsed as Partial<Record<keyof A11yPreferences, unknown>>;
    const scale = Number(value.fontScale);
    return {
      fontScale: A11Y_FONT_SCALES.some((step) => step === scale) ? scale : 1,
      highContrast: value.highContrast === true,
      underlineLinks: value.underlineLinks === true,
      enhancedFocus: value.enhancedFocus === true,
      reduceMotion: value.reduceMotion === true,
    };
  } catch {
    return A11Y_DEFAULTS;
  }
}

export function readA11yPreferences(): A11yPreferences {
  if (typeof window === "undefined") return A11Y_DEFAULTS;
  try {
    return parseA11yPreferences(window.localStorage.getItem(A11Y_STORAGE_KEY));
  } catch {
    // Private-mode Safari throws on localStorage access rather than returning null.
    return A11Y_DEFAULTS;
  }
}

/** Writes the preferences onto <html>. Mirrors what the inline script does at boot. */
export function applyA11yPreferences(prefs: A11yPreferences): void {
  const root = document.documentElement;
  root.style.setProperty(A11Y_FONT_SCALE_VAR, String(prefs.fontScale));
  toggle(root, A11Y_ATTR.contrast, prefs.highContrast, "high");
  toggle(root, A11Y_ATTR.links, prefs.underlineLinks, "underline");
  toggle(root, A11Y_ATTR.focus, prefs.enhancedFocus, "enhanced");
  toggle(root, A11Y_ATTR.motion, prefs.reduceMotion, "reduce");
}

export function persistA11yPreferences(prefs: A11yPreferences): void {
  try {
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked — the settings still apply for this page view.
  }
}

function toggle(root: HTMLElement, attr: string, on: boolean, value: string): void {
  if (on) root.setAttribute(attr, value);
  else root.removeAttribute(attr);
}
