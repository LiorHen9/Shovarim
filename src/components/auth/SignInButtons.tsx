"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signInWithProvider } from "@/lib/auth/authService";
import { createSession } from "@/actions/auth";
import { SUPPORTED_PROVIDERS } from "@/lib/auth/providers";
import {
  buildSignInErrorMessage,
  isCancelledByUser,
  toAuthErrorCode,
} from "@/lib/auth/authErrors";
import { reportAuthError } from "@/lib/auth/reportAuthError";
import type { AuthErrorStage } from "@/lib/validation/clientError";

export function SignInButtons() {
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSignIn(providerId: (typeof SUPPORTED_PROVIDERS)[number]["id"]) {
    setPendingProviderId(providerId);
    // Tracked across the try so the catch can tell a failed Google popup from
    // a failed session-cookie mint — the two used to collapse into one
    // indistinguishable toast (docs/DECISIONS.md ADR #27).
    let stage: AuthErrorStage = "provider-sign-in";
    try {
      const user = await signInWithProvider(providerId);
      const idToken = await user.getIdToken();
      stage = "create-session";
      await createSession(idToken);
      router.push(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } catch (error) {
      const code = toAuthErrorCode(error);
      console.error(`sign-in failed at ${stage} (${code})`, error);

      // A user who closed the popup didn't hit an error — no scary toast, and
      // nothing worth spending a log line on.
      if (!isCancelledByUser(code)) {
        void reportAuthError({ stage, providerId, code });
        toast.error(buildSignInErrorMessage(stage, code));
      }
    } finally {
      setPendingProviderId(null);
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
