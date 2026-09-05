import Link from "next/link";

// Under תקנה 35 of תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות),
// תשע"ג-2013, the accessibility statement has to be findable — not buried on a page that
// is itself only reachable from one place. Until now /privacy and /terms were linked only
// from the landing page and the settings page, so a signed-in user had no route to either
// from most of the app.
//
// Mounted in the root layout, so it is present on public pages, protected pages and the
// 404 alike. It is deliberately not inside (protected)/layout.tsx.
const LINKS = [
  { href: "/accessibility", label: "הצהרת נגישות" },
  { href: "/privacy", label: "מדיניות פרטיות" },
  { href: "/terms", label: "תנאי שימוש" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      {/* Labelled so a screen reader reading the landmark list can tell this nav apart
          from the primary nav in the Header. */}
      <nav
        aria-label="קישורים משפטיים"
        className="text-muted-foreground mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 p-4 text-sm"
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-foreground underline underline-offset-2"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
