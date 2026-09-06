"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { grantTestAdmin } from "@/actions/testSeed";

// Playwright-only, same shape as ./e2e/seed-clubs. adminRoles is Admin-SDK-only
// (firestore.rules) and there is no UI path to create an admin — on purpose —
// so a test that needs /admin has to come through here. The action is
// hard-guarded to the emulator; this is the second, client-side guard.
// Suspense for the same reason as ./sign-in: useSearchParams() opts a page out
// of static prerendering unless it sits inside one, and the build fails rather
// than warns.
export default function E2EGrantAdminPage() {
  return (
    <Suspense fallback={<p role="status">pending</p>}>
      <GrantAdmin />
    </Suspense>
  );
}

function GrantAdmin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const ran = useRef(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true" || !uid) {
      router.replace("/");
      return;
    }

    grantTestAdmin(uid)
      .then(() => setStatus("granted"))
      .catch(() => setStatus("failed"));
  }, [router, uid]);

  return <p role="status">{status ?? "pending"}</p>;
}
