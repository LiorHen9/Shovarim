"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signInWithProvider } from "@/lib/auth/authService";
import { createSession } from "@/actions/auth";
import { SUPPORTED_PROVIDERS } from "@/lib/auth/providers";

export function SignInButtons() {
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSignIn(providerId: (typeof SUPPORTED_PROVIDERS)[number]["id"]) {
    setPendingProviderId(providerId);
    try {
      const user = await signInWithProvider(providerId);
      const idToken = await user.getIdToken();
      await createSession(idToken);
      router.push(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("ההתחברות נכשלה, נסו שוב");
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
