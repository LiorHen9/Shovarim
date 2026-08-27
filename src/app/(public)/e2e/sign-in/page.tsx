"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";

import { auth } from "@/lib/firebase/client";
import { createSession } from "@/actions/auth";
import { mintTestCustomToken } from "@/actions/testAuth";

// Playwright-only sign-in shortcut. Real sign-in drives a Google OAuth popup
// (see SignInButtons.tsx), which automated browsers can't do — Google blocks
// it. This page does the same two steps (client sign-in -> createSession)
// but sources the credential from mintTestCustomToken() instead of Google,
// so it exercises the real session/cookie/profile-bootstrap path.
// mintTestCustomToken() throws outside the emulator, and the check below is
// a second, client-side guard — see docs/DECISIONS.md #18.
export default function E2ESignInPage() {
  return (
    <Suspense fallback={null}>
      <E2ESignIn />
    </Suspense>
  );
}

function E2ESignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") {
      router.replace("/");
      return;
    }

    const uid = searchParams.get("uid");
    if (!uid) return;

    (async () => {
      const customToken = await mintTestCustomToken(uid, {
        email: searchParams.get("email") ?? undefined,
        name: searchParams.get("name") ?? undefined,
      });
      const credential = await signInWithCustomToken(auth, customToken);
      const idToken = await credential.user.getIdToken();
      await createSession(idToken);
      router.replace(searchParams.get("next") ?? "/dashboard");
    })();
  }, [router, searchParams]);

  return null;
}
