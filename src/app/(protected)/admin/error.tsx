"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Separate from (protected)/error.tsx on purpose. The admin segment is Server Components
// over the Admin SDK, so its failure modes are different from the client-hook pages —
// a missing composite index surfaces as FAILED_PRECONDITION (see ADR #50, which added
// per-card try/catch after exactly that took down /admin/users/[uid] in production).
// Keeping the boundary here means an admin page crash does not swallow the whole
// signed-in tree, and the link back points into the panel rather than out of it.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] render failed", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
      <h1 className="text-2xl font-bold">שגיאה בפאנל הניהול</h1>
      <p className="text-muted-foreground max-w-md">
        לא הצלחנו להציג את העמוד. אם זה חוזר, כדאי לבדוק ב-Cloud Logging לפי קוד השגיאה —
        אינדקס חסר ב-Firestore הוא החשוד הראשון.
      </p>
      {error.digest && (
        <p className="text-muted-foreground text-sm">קוד שגיאה: {error.digest}</p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>נסו שוב</Button>
        <Button variant="outline" asChild>
          <Link href="/admin">חזרה לפאנל</Link>
        </Button>
      </div>
    </div>
  );
}
