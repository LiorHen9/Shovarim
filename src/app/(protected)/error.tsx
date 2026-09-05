"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Error boundary for the whole signed-in area. Before this existed, an uncaught render
// error hit Next's default boundary — no Hebrew, no RTL, and no way back into the app.
// ADR #48 is the concrete precedent: a raw Firestore Timestamp crossing into a Client
// Component took down a production page with an opaque digest and no recovery path.
//
// The layout still renders around this (Header, banners), so the user keeps their nav.
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe identifier — Next redacts the message in production,
    // and this is the id that matches the App Hosting log line (ADR #48's workflow).
    console.error("[protected] render failed", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
      <h1 className="text-2xl font-bold">משהו השתבש</h1>
      <p className="text-muted-foreground max-w-md">
        לא הצלחנו להציג את העמוד. אפשר לנסות שוב — ואם זה חוזר, כדאי לחזור לדף הראשי.
      </p>
      {error.digest && (
        <p className="text-muted-foreground text-sm">קוד שגיאה: {error.digest}</p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>נסו שוב</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">חזרה לדף הראשי</Link>
        </Button>
      </div>
    </div>
  );
}
