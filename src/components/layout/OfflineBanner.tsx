"use client";

import { useOffline } from "next/offline";
import { CloudOff, WifiOff } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

// Connectivity indicator for the signed-in area. Two signals, deliberately, because
// they answer different questions (ADR #53):
//
//   useOffline()  — the browser cannot reach the origin at all. Next flips this on the
//                   `offline` event *and* on any failed framework fetch, so it catches a
//                   captive portal where navigator.onLine still says true.
//   fromCache     — the origin is fine but Firestore's listener stream is not delivering,
//                   so every card on screen is stale. Nothing in useOffline() sees this.
//
// This is a static bar, not a toast: connectivity is a *state*, and a flaky mobile
// network would otherwise produce a stream of auto-dismissing toasts. role="status" plus
// aria-live="polite" also satisfies the item in docs/ACCESSIBILITY.md about announcing
// onSnapshot-driven status changes.
export function OfflineBanner() {
  const isOffline = useOffline();
  const { user } = useAuth();
  const { fromCache } = useUserProfile(user?.uid ?? null);

  // Being offline subsumes a stale cache, so it wins and only one bar ever shows.
  if (isOffline) {
    return (
      <Bar>
        <WifiOff className="size-4 shrink-0" />
        אין חיבור לאינטרנט. פעולות ממתינות יישלחו כשהחיבור יחזור.
      </Bar>
    );
  }

  if (fromCache) {
    return (
      <Bar>
        <CloudOff className="size-4 shrink-0" />
        מוצגים נתונים שמורים. מתחבר מחדש…
      </Bar>
    );
  }

  return null;
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {children}
    </div>
  );
}
