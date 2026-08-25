import { Suspense } from "react";

import { SignInButtons } from "@/components/auth/SignInButtons";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">שוברים</h1>
        <p className="text-muted-foreground">ניהול שוברים וכרטיסי מתנה במקום אחד</p>
      </div>
      <Suspense>
        <SignInButtons />
      </Suspense>
      <p className="text-xs text-muted-foreground max-w-xs">
        בהתחברות אתם מאשרים את{" "}
        <a href="/terms" className="underline underline-offset-2">
          תנאי השימוש
        </a>{" "}
        ואת{" "}
        <a href="/privacy" className="underline underline-offset-2">
          מדיניות הפרטיות
        </a>
        .
      </p>
    </main>
  );
}
