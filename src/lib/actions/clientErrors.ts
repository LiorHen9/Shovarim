"use client";

import { unstable_isUnrecognizedActionError } from "next/navigation";
import { toast } from "sonner";

// Client-side counterpart to src/lib/actions/errorsCore.ts. That file handles *expected*
// failures, which travel back as `{ error }` data (ADR #18). This one handles what lands
// in a `catch`: an error that escaped the Server Action entirely.
//
// The case worth singling out is the one documented in ADR #32 and docs/DEPLOYMENT.md:
// after every App Hosting rollout, a tab that was already open POSTs a Server Action id
// the new server does not recognise and gets a 404 with `x-nextjs-action-not-found: 1`.
// Next 16 surfaces that as a typed UnrecognizedActionError, so instead of a misleading
// "העדכון נכשל" the user gets told the truth — the page is stale and a reload fixes it.
//
// Pinning NEXT_SERVER_ACTIONS_ENCRYPTION_KEY (docs/DEPLOYMENT.md) makes action ids stable
// across builds and so makes this rare, but it cannot make it impossible: the key can be
// rotated, and a deploy that changes an action's module still changes its id.
//
// Note the `unstable_` prefix. Verified against Next 16.3.2
// (node_modules/next/dist/client/components/unrecognized-action-error.d.ts); re-check on
// every Next upgrade.

/** Shown instead of the caller's message when the client bundle is out of date. */
const STALE_BUNDLE_TITLE = "גרסה חדשה של האפליקציה זמינה";
const STALE_BUNDLE_DESCRIPTION = "יש לרענן את הדף כדי להמשיך.";

/**
 * Reports a failed action to the user. Pass the caught error and the message to show for
 * an ordinary failure; a stale-bundle error is detected and reported differently.
 */
export function reportActionError(error: unknown, fallbackMessage: string): void {
  if (unstable_isUnrecognizedActionError(error)) {
    // Persistent and actionable, unlike every other toast in the app: the page cannot
    // recover on its own, so an auto-dismissing message would strand the user.
    toast.error(STALE_BUNDLE_TITLE, {
      description: STALE_BUNDLE_DESCRIPTION,
      duration: Infinity,
      action: {
        label: "רענון",
        onClick: () => window.location.reload(),
      },
    });
    return;
  }

  toast.error(fallbackMessage);
}
