"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes has been a dependency since the scaffold and src/app/globals.css carries a
// complete `.dark` token set behind `@custom-variant dark`, but no provider was ever
// mounted — so dark mode was dead code, and useTheme() in src/components/ui/sonner.tsx
// silently returned undefined. This revives what was already written (ADR #55).
//
// `attribute="class"` is what the @custom-variant in globals.css keys off.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
