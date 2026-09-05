"use client";

import { useOffline } from "next/offline";

// Rendered by each route's loading.tsx above its skeleton. When a navigation is blocked
// on a dead network, the prefetched route shell paints immediately and the dynamic part
// waits — so without this the user stares at a skeleton that will never resolve, with no
// explanation. Next retries the blocked request automatically once connectivity returns.
//
// Kept as its own client component so the loading.tsx files themselves stay Server
// Components; only this one line of markup needs the hook.
export function WaitingForConnection() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <p role="status" className="text-muted-foreground py-2 text-center text-sm">
      ממתינים לחיבור…
    </p>
  );
}
