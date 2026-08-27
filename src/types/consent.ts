import type { Timestamp } from "firebase/firestore";

// consents/{uid} — see docs/DATA_MODEL.md.
export interface Consent {
  uid: string;
  privacyPolicyVersion: string;
  acceptedAt: Timestamp;
  marketingConsent: boolean;
  ip: string | null;
}
