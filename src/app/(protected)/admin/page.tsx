import Link from "next/link";

// Foundations shell (docs/DECISIONS.md ADR #42, docs/ROADMAP.md Phase 9.1),
// now linking into the user directory (Phase 9.2). Access is already gated
// by admin/layout.tsx.
export default function AdminHomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ניהול מערכת</h1>
        <p className="text-sm text-muted-foreground">
          ראו docs/ROADMAP.md Phase 9 לשלבים הבאים (חסימה, מחיקה, מעקב שימוש).
        </p>
      </div>

      <Link href="/admin/users" className="underline underline-offset-2">
        משתמשים
      </Link>
    </div>
  );
}
