"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type ThemeName = "system" | "light" | "dark";

const ORDER: ThemeName[] = ["system", "light", "dark"];

const LABELS: Record<ThemeName, { text: string; Icon: typeof Sun }> = {
  system: { text: "ערכת נושא: לפי המערכת", Icon: Monitor },
  light: { text: "ערכת נושא: בהירה", Icon: Sun },
  dark: { text: "ערכת נושא: כהה", Icon: Moon },
};

function isThemeName(value: string | undefined): value is ThemeName {
  return value === "system" || value === "light" || value === "dark";
}

// Cycles system → light → dark. A single menu item rather than a submenu: there are only
// three states and the current one is spelled out in the label, so a submenu would be
// more chrome than choice.
//
// No `mounted` guard is needed here even though next-themes only knows the stored
// preference on the client. This renders inside DropdownMenuContent, which Radix mounts
// only once the menu is opened — always after hydration — so there is no server render of
// this component to mismatch against.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const current: ThemeName = isThemeName(theme) ? theme : "system";
  const { text, Icon } = LABELS[current];

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        // Keep the menu open so the label change is visible and the user can keep cycling.
        event.preventDefault();
        setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system");
      }}
    >
      <Icon className="size-4" />
      {text}
    </DropdownMenuItem>
  );
}
