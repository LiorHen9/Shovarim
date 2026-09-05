"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Accessibility } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { A11Y_FONT_SCALES } from "@/lib/a11y/constants";
import {
  A11Y_DEFAULTS,
  applyA11yPreferences,
  persistA11yPreferences,
  readA11yPreferences,
  type A11yPreferences,
} from "@/lib/a11y/preferences";

// The accessibility toolbar (issue #40).
//
// Built here rather than installed. תקנה 35 of תקנות שוויון זכויות לאנשים עם מוגבלות
// (התאמות נגישות לשירות), תשע"ג-2013 requires conformance with ת"י 5568 at level AA and a
// published accessibility statement — it does not require a floating widget. Third-party
// overlay widgets earn their bad reputation by injecting ARIA over a DOM that is already
// correct; this app is built on Radix primitives whose semantics are right to begin with,
// so an overlay could only make them worse.
//
// Everything below is a native form control inside a <fieldset> with a <legend>. No custom
// radio or switch implementation, which means the keyboard semantics, the grouping and the
// screen-reader announcements come from the browser and cannot be got subtly wrong. A
// toolbar for disabled users is the one component that has no excuse for a custom widget.

const TOGGLES = [
  { key: "highContrast", label: "ניגודיות גבוהה" },
  { key: "underlineLinks", label: "הדגשת קישורים" },
  { key: "enhancedFocus", label: "הדגשת מיקוד מקלדת" },
  { key: "reduceMotion", label: "עצירת אנימציות" },
] as const satisfies readonly { key: keyof A11yPreferences; label: string }[];

export function AccessibilityToolbar() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          // Vertically centred against the viewport, at the inline end — which under
          // dir="rtl" is the left edge, where Israeli sites conventionally place it.
          //
          // -translate-y-1/2 is safe here even though Button's base carries
          // active:not-aria-[haspopup]:translate-y-px: PopoverTrigger sets
          // aria-haspopup="dialog", so that variant excludes this button and cannot
          // overwrite --tw-translate-y.
          className="fixed end-4 top-1/2 z-50 size-12 -translate-y-1/2 rounded-full shadow-lg"
        >
          <Accessibility className="size-6" aria-hidden="true" />
          <span className="sr-only">הגדרות נגישות</span>
        </Button>
      </PopoverTrigger>
      {/* Opens sideways, not downward. With the trigger centred vertically, the default
          side="bottom" leaves this ~340px panel only half the viewport, which collides on
          any phone-height screen; opening along the inline axis gives it the full height.

          side is physical, not logical: @radix-ui/react-popper 1.3.7 builds the placement
          as `side + align` with no dir handling at all, and does not accept
          inline-start/inline-end. dir="rtl" is fixed in the root layout, so end-4 is the
          physical left edge and "right" is the direction of the page centre. Do not
          "correct" this to "left". */}
      <PopoverContent
        side="right"
        align="center"
        collisionPadding={16}
        className="w-72"
        aria-label="הגדרות נגישות"
      >
        {/* Radix mounts this only once opened, i.e. always after hydration, so the panel
            can read localStorage in a lazy useState initialiser without a mismatch. Same
            reasoning as ThemeToggle. */}
        <AccessibilityPanel />
      </PopoverContent>
    </Popover>
  );
}

function AccessibilityPanel() {
  const [prefs, setPrefs] = useState<A11yPreferences>(readA11yPreferences);
  const scaleName = useId();

  function update(patch: Partial<A11yPreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyA11yPreferences(next);
    persistA11yPreferences(next);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">הגדרות נגישות</h2>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">גודל טקסט</legend>
        <div className="flex gap-2">
          {A11Y_FONT_SCALES.map((scale) => {
            const id = `${scaleName}-${scale}`;
            return (
              <div key={scale} className="flex-1">
                <input
                  type="radio"
                  id={id}
                  name={scaleName}
                  className="peer sr-only"
                  checked={prefs.fontScale === scale}
                  onChange={() => update({ fontScale: scale })}
                />
                <label
                  htmlFor={id}
                  className="border-input peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-ring block cursor-pointer rounded-md border px-2 py-1.5 text-center text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
                >
                  {Math.round(scale * 100)}%
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">תצוגה</legend>
        {TOGGLES.map(({ key, label }) => {
          const id = `${scaleName}-${key}`;
          return (
            <div key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={id}
                className="accent-primary size-4"
                checked={prefs[key] === true}
                onChange={(event) => update({ [key]: event.target.checked })}
              />
              <label htmlFor={id} className="cursor-pointer text-sm">
                {label}
              </label>
            </div>
          );
        })}
      </fieldset>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPrefs(A11Y_DEFAULTS);
            applyA11yPreferences(A11Y_DEFAULTS);
            persistA11yPreferences(A11Y_DEFAULTS);
          }}
        >
          איפוס
        </Button>
        <Link href="/accessibility" className="text-sm underline underline-offset-2">
          הצהרת נגישות
        </Link>
      </div>
    </div>
  );
}
