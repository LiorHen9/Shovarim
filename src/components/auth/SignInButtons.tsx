"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  // Covers the sign-in screen while the round trip back from the provider is
  // still being settled, so the user doesn't see the login page again between
  // the redirect landing and `/dashboard` rendering (issue #47). Same reason
  // as `pendingProviderId` above for starting `false`: SSR can't know a
  // redirect is pending, so anything else would be a hydration mismatch.
  const [isCompletingRedirect, setIsCompletingRedirect] = useState(false);
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
      // Raised synchronously, before the first `await` below: the whole point
      // is to beat the async chain (redirect result → id token → session
      // cookie → navigation), which is what makes the flash last long enough
      // to notice. Gated on the stored provider so a plain visitor — for whom
      // `completeRedirectSignIn()` just resolves `null` — never sees it.
      if (providerId) setIsCompletingRedirect(true);
      // Tracked so the catch can tell a failed redirect from a failed
      // session-cookie mint — the two used to collapse into one
      // indistinguishable toast (docs/DECISIONS.md ADR #27).
      let stage: AuthErrorStage = "provider-sign-in";
      try {
        const user = await completeRedirectSignIn();
        if (!user) {
          setPendingProviderId(null);
          setIsCompletingRedirect(false);
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
        // Only lowered on failure. On the success path the overlay is left up
        // deliberately: `router.push` is async, and clearing it here would put
        // the login screen back on screen for exactly the stretch this issue
        // is about. The component unmounts with the navigation instead.
        setIsCompletingRedirect(false);
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
    <>
      {isCompletingRedirect ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          data-testid="redirect-sign-in-overlay"
        >
          {/* Opaque card rather than bare text on the scrim: the blurred
              sign-in button sits directly behind this spot, and dark-on-dark
              there fell short of the 4.5:1 the accessibility checklist wants. */}
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-background px-6 py-5 shadow-lg">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">מתחברים לחשבון…</p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 w-full max-w-xs" aria-busy={isCompletingRedirect}>
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
    </>
  );
}
