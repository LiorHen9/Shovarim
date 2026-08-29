"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { redeemTestLinkCode } from "@/actions/testChannelLink";

// Playwright-only stand-in for the WhatsApp webhook (Phase 5.5.b), in the same
// shape as ./e2e/sign-in: a page exists because a Server Action can only be
// invoked from the browser, and the test needs to redeem a code as an
// *unauthenticated* inbound sender would. The action itself is hard-guarded to
// the emulator; the check below is the second, client-side guard — see
// docs/DECISIONS.md #18.
export default function E2ERedeemLinkPage() {
  return (
    <Suspense fallback={null}>
      <E2ERedeemLink />
    </Suspense>
  );
}

function E2ERedeemLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") {
      router.replace("/");
      return;
    }

    const externalId = searchParams.get("externalId");
    const code = searchParams.get("code");
    if (!externalId || !code) return;

    redeemTestLinkCode({ channel: "whatsapp", externalId, code })
      .then((result) => setStatus(result.ok ? "redeemed" : `failed: ${result.error}`))
      .catch(() => setStatus("failed: unexpected"));
  }, [router, searchParams]);

  return <p role="status">{status ?? "pending"}</p>;
}
