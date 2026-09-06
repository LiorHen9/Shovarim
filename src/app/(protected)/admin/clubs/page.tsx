import type { Metadata } from "next";
import Link from "next/link";

import { listCatalogForAdmin } from "@/lib/services/adminClubs";
import { ClubCatalogManager } from "@/components/admin/ClubCatalogManager";

// Access is already gated twice over — (protected)/layout.tsx for the session,
// admin/layout.tsx for adminRoles/{uid} — so this page only reads. Every
// mutation goes through src/actions/adminClubs.ts, which re-checks the role:
// a page-level gate cannot protect a Server Action, which is POST-able on its
// own (ADR #42).
// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "ניהול מועדונים" };

export default async function AdminClubsPage() {
  const catalog = await listCatalogForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">ניהול מועדונים</h1>
        <p className="text-sm text-muted-foreground">
          קטלוג המועדונים והכרטיסים שתחתיהם, כפי שהוא מוצג ב-
          <Link href="/clubs" className="underline underline-offset-2">
            עמוד המועדונים
          </Link>
          .
        </p>
      </div>

      <ClubCatalogManager catalog={catalog} />
    </div>
  );
}
