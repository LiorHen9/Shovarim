import Link from "next/link";

import { Button } from "@/components/ui/button";

// Until now a 404 on this Hebrew, RTL site rendered Next's default English page — the
// smoke test in docs/DEPLOYMENT.md records "GET /nonexistent-route → 404 תקין", which was
// true about the status code and wrong about what the visitor saw.
//
// This sits at the root, so it also serves 404s for signed-out visitors; the link goes to
// "/" rather than /dashboard, which src/proxy.ts would bounce straight back for them.
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">הדף לא נמצא</h1>
      <p className="text-muted-foreground">
        הקישור שהגעתם דרכו כנראה שגוי, או שהדף כבר לא קיים.
      </p>
      <Button asChild>
        <Link href="/">חזרה לדף הבית</Link>
      </Button>
    </main>
  );
}
