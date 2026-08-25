"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/constants";

type ConsentStatus = "loading" | "needed" | "granted";

export function useConsent(uid: string | null) {
  const [status, setStatus] = useState<ConsentStatus>("loading");

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "consents", uid);
    return onSnapshot(ref, (snap) => {
      const data = snap.data();
      setStatus(data?.privacyPolicyVersion === PRIVACY_POLICY_VERSION ? "granted" : "needed");
    });
  }, [uid]);

  async function grantConsent() {
    if (!uid) return;
    await setDoc(doc(db, "consents", uid), {
      uid,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      acceptedAt: serverTimestamp(),
      marketingConsent: false,
      ip: null,
    });
  }

  return { status, grantConsent };
}
