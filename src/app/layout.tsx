import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { A11yPreferencesScript } from "@/components/a11y/A11yPreferencesScript";
import { AccessibilityToolbar } from "@/components/a11y/AccessibilityToolbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SkipLink } from "@/components/layout/SkipLink";
import { Toaster } from "@/components/ui/sonner";
import { getAppUrl } from "@/lib/appUrl";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  // Makes the Open Graph image URL below absolute, which is what link scrapers need.
  metadataBase: new URL(getAppUrl()),
  // A template rather than a bare string. Every page in the app used to render the same
  // <title>, which fails WCAG 2.4.2 Page Titled (Level A) — the title has to describe the
  // page's topic or purpose, and it is the first thing a screen reader announces on
  // navigation. axe never flagged it: its document-title rule only checks for emptiness.
  title: {
    default: "שוברים",
    template: "%s · שוברים",
  },
  description: "ניהול שוברים וכרטיסי מתנה",
  applicationName: "שוברים",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "שוברים",
  },
  // The app's primary sharing channel is WhatsApp (ADR #37/#39 — NEXT_PUBLIC_APP_URL
  // exists so invite links are absolute), and WhatsApp scrapes OG tags for the preview
  // card. Without these, a shared /invite/<code> link renders as a bare URL.
  //
  // The image is deliberately static and root-level: the invite code is a bearer token,
  // and an OG endpoint is an unauthenticated fetch, so there must be no per-invite image.
  // Verified that GET /invite/[code] is read-only for an anonymous scraper — it only
  // calls getListInvitePreview (two .get() reads) and never consumes the code.
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "שוברים",
    title: "שוברים",
    description: "ניהול שוברים וכרטיסי מתנה",
  },
};

export const viewport: Viewport = {
  // Derived from the tokens in globals.css, not eyeballed: light --background is
  // oklch(1 0 0) -> #ffffff, dark --background is oklch(0.145 0 0) -> #0a0a0a (both
  // achromatic, so Y = L³ and the sRGB transfer function gives these exactly).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
  // Deliberately no maximumScale/userScalable. Locking zoom is the usual trick to make a
  // PWA "feel native" and it directly violates the item docs/ACCESSIBILITY.md already
  // lists ("תפקוד תקין עד zoom 200% ללא אובדן תוכן"). It would also fight the font-scaling
  // control that the accessibility toolbar in Phase 6.A needs.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning is required, not cosmetic: next-themes writes the theme
    // class onto <html> before React hydrates, so the server and client markup differ by
    // design on this one element.
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Before anything renders, so a user who chose 150% text never sees 100% first. */}
        <A11yPreferencesScript />
        <ThemeProvider>
          {/* First focusable element in the document, by requirement. */}
          <SkipLink />
          {children}
          <SiteFooter />
          <AccessibilityToolbar />
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
