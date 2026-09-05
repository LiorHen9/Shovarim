"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/user";

export function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Whether this snapshot was served from Firestore's local cache rather than the
  // backend — i.e. the listener stream is not currently reaching Google.
  //
  // This doubles as the app-wide "Firestore is unreachable" signal (see
  // OfflineBanner). It lives on this hook rather than being threaded through all ten
  // of them because users/{uid} is the one document every signed-in user always
  // listens to, so one listener answers the question for the whole app.
  //
  // It is a truer signal than useOffline() for this app: 100% of the protected UI's
  // data comes from onSnapshot, and Firestore's long-lived stream can be dead while
  // plain HTTP is fine — an expired App Check token (ADR #27/#28), a blocked
  // endpoint, a revoked token. Next's HEAD probe would report "online" while every
  // card on screen is stale.
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      setFromCache(snap.metadata.fromCache);
      setLoading(false);
    });
  }, [uid]);

  if (!uid) return { profile: null, loading: false, fromCache: false };
  return { profile, loading, fromCache };
}
