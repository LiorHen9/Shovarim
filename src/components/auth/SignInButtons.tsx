"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { completeRedirectSignIn, signInWithProvider } from "@/lib/auth/authService";
import { createSession } from "@/actions/auth";
import { SUPPORTED_PROVIDERS, type AuthProviderId } from "@/lib/auth/providers";
import {
  buildSignInErrorMessage,
  isCancelledByUser,
  toAuthErrorCode,
} from "@/lib/auth/authErrors";
import { reportAuthError } from "@/lib/auth/reportAuthError";
import type { AuthErrorStage } from "@/lib/validation/clientError";

// `signInWithRedirect` navigates the whole page away, so the provider chosen
// before the redirect has to survive the round trip through sessionStorage —
// there is no in-memory state left to read it from once the app remounts on
// the way back from Google (docs/DECISIONS.md ADR #34).
const PENDING_PROVIDER_KEY = "shovarim:pendingSignInProvider";

function readPendingProviderId(): AuthProviderId | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(PENDING_PROVIDER_KEY);
  return SUPPORTED_PROVIDERS.some((provider) => provider.id === stored)
    ? (stored as AuthProviderId)
    : null;
}

export function SignInButtons() {
  // Must start `null` to match the server-rendered markup (SSR has no
  // sessionStorage) — reading the stored provider synchronously here would
  // make the client's first render disagree with the server's and trigger a
  // hydration mismatch on the page the redirect lands back on. The real
  // value is picked up a moment later, inside the effect below.
  const [pendingProviderId, setPendingProviderId] = useState<AuthProviderId | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Always run, on every mount — this is the Firebase-recommended pattern
    // for redirect sign-in: `getRedirectResult` resolves to `null` (not an
    // error) when there is no pending redirect, so this is a cheap no-op on
    // a normal page load. It must not be gated behind the sessionStorage
    // flag below, which is only a UI/telemetry hint and can be lost (private
    // browsing, a cleared tab) without losing the actual redirect result.
    async function completeSignIn() {
      const providerId = readPendingProviderId();
      setPendingProviderId(providerId);
      // Tracked so the catch can tell a failed redirect from a failed
      // session-cookie mint — the two used to collapse into one
      // indistinguishable toast (docs/DECISIONS.md ADR #27).
      let stage: AuthErrorStage = "provider-sign-in";
      try {
        const user = await completeRedirectSignIn();
        if (!user) {
          setPendingProviderId(null);
          return;
        }
        const idToken = await user.getIdToken();
        stage = "create-session";
        await createSession(idToken);
        router.push(searchParams.get("next") ?? "/dashboard");
        router.refresh();
      } catch (error) {
        const code = toAuthErrorCode(error);
        console.error(`sign-in failed at ${stage} (${code})`, error);

        // A user who backed out of the Google account chooser didn't hit an
        // error — no scary toast, and nothing worth spending a log line on.
        if (!isCancelledByUser(code)) {
          if (providerId) void reportAuthError({ stage, providerId, code });
          toast.error(buildSignInErrorMessage(stage, code));
        }
      } finally {
        setPendingProviderId(null);
        window.sessionStorage.removeItem(PENDING_PROVIDER_KEY);
      }
    }

    void completeSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(providerId: AuthProviderId) {
    setPendingProviderId(providerId);
    window.sessionStorage.setItem(PENDING_PROVIDER_KEY, providerId);
    try {
      await signInWithProvider(providerId);
    } catch (error) {
      // The redirect never started (e.g. an unsupported environment) — no
      // round trip is coming, so clean up immediately instead of waiting for
      // a mount that will never see a pending redirect.
      const code = toAuthErrorCode(error);
      console.error(`sign-in redirect failed to start (${code})`, error);
      void reportAuthError({ stage: "provider-sign-in", providerId, code });
      toast.error(buildSignInErrorMessage("provider-sign-in", code));
      setPendingProviderId(null);
      window.sessionStorage.removeItem(PENDING_PROVIDER_KEY);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {SUPPORTED_PROVIDERS.map((provider) => (
        <Button
          key={provider.id}
          onClick={() => handleSignIn(provider.id)}
          disabled={pendingProviderId !== null}
          size="lg"
        >
          {pendingProviderId === provider.id ? "מתחבר..." : provider.labelHe}
        </Button>
      ))}
    </div>
  );
}
