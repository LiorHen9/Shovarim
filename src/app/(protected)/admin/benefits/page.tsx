import type { Metadata } from "next";
import Link from "next/link";

import { listScrapeStatus } from "@/lib/services/adminBenefits";
import { BenefitScrapeStatus } from "@/components/admin/BenefitScrapeStatus";

// Gated twice over, like every other admin page — (protected)/layout.tsx for
// the session and admin/layout.tsx for adminRoles/{uid}. This page only reads;
// the one action it offers goes straight to a Cloud Function callable that
// re-checks the admin role itself, because a page-level gate cannot protect an
// endpoint that is callable on its own (ADR #42).
export const metadata: Metadata = { title: "הטבות מועדונים" };

export default async function AdminBenefitsPage() {
  const statuses = await listScrapeStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">הטבות מועדונים</h1>
        <p className="text-sm text-muted-foreground">
          הסקרייפרים רצים אוטומטית כל יום ב-04:00 ודורסים את ההטבות הקיימות בתמונת מצב חדשה. תקרת
          החילוץ של כל מועדון וכרטיס נקבעת ב-
          <Link href="/admin/clubs" className="underline underline-offset-2">
            ניהול מועדונים
          </Link>
          .
        </p>
      </div>

      <BenefitScrapeStatus statuses={statuses} />
    </div>
  );
}
