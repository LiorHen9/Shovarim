// Foundations shell (docs/DECISIONS.md ADR #42, docs/ROADMAP.md Phase 9.1).
// Access is already gated by admin/layout.tsx; this page is the landing spot
// until later phases (user directory, blocking, deletion, usage/analytics
// dashboards) add real content here.
export default function AdminHomePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold">ניהול מערכת</h1>
      <p className="text-sm text-muted-foreground">
        פאנל הניהול בבנייה — ראו docs/ROADMAP.md Phase 9 לשלבים הבאים (צפייה במשתמשים, חסימה,
        מחיקה, מעקב שימוש).
      </p>
    </div>
  );
}
