import type { Metadata } from "next";
import { A11Y_MAIN_CONTENT_ID } from "@/lib/a11y/constants";
import { getSessionUid } from "@/lib/auth/session";
import { getListInviteGate, getListInvitePreview } from "@/lib/services/listInvites";
import { inviteCodeSchema } from "@/lib/validation/listInvite";
import { InvitePanel } from "@/components/lists/InvitePanel";
import type { ListInviteGate, ListInvitePreview } from "@/types/listInvite";

// Public route: the invite code is the secret, so the preview renders without
// a session (ADR #37). Deliberately outside (protected) — a recipient with no
// account has to be able to see what they were invited to before signing in,
// and src/proxy.ts only guards the protected page prefixes.
// Per-page <title> (WCAG 2.4.2, Level A) — see the note in src/app/layout.tsx.
export const metadata: Metadata = { title: "הזמנה לרשימה משותפת" };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;

  const parsed = inviteCodeSchema.safeParse(rawCode);
  if (!parsed.success) return <InviteError message="קוד ההזמנה אינו תקין." />;
  const code = parsed.data;

  let preview: ListInvitePreview;
  try {
    preview = await getListInvitePreview(code);
  } catch {
    // One message for every failure mode (missing, deleted list): whoever holds
    // this link is unauthenticated by definition, and distinguishing the cases
    // would confirm which codes exist.
    return <InviteError message="ההזמנה אינה קיימת או שפג תוקפה." />;
  }

  // The gate is resolved server-side when there is a session, so the page does
  // not flash "sign in" at someone who is already signed in and ready.
  const uid = await getSessionUid();
  let gate: ListInviteGate | null = null;
  if (uid) {
    try {
      gate = await getListInviteGate(uid, code);
    } catch {
      gate = null;
    }
  }

  return (
    <main id={A11Y_MAIN_CONTENT_ID} className="mx-auto max-w-md space-y-6 p-6">
      <InvitePanel preview={preview} initialGate={gate} signedIn={uid !== null} />
    </main>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <main id={A11Y_MAIN_CONTENT_ID} className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">הזמנה לרשימה</h1>
      <p className="text-muted-foreground">{message}</p>
    </main>
  );
}
