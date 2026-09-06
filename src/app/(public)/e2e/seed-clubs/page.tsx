"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { seedTestClubCatalog } from "@/actions/testSeed";

// Playwright-only, same shape as ./e2e/sign-in and ./e2e/redeem-link: a page
// exists because a Server Action can only be invoked from the browser. The
// clubs/clubCards catalog is Admin-SDK-only by design (ADR #61), so unlike
// cards a test cannot create it through the app's own UI. The action is
// hard-guarded to the emulator; the check below is the second, client-side
// guard — see docs/DECISIONS.md #18.
export default function E2ESeedClubsPage() {
  const router = useRouter();
  const ran = useRef(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") {
      router.replace("/");
      return;
    }

    seedTestClubCatalog()
      .then(() => setStatus("seeded"))
      .catch(() => setStatus("failed"));
  }, [router]);

  return <p role="status">{status ?? "pending"}</p>;
}
