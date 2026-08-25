import type { Timestamp } from "firebase/firestore";

export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  reminderDaysBefore: number[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  authProvider: "google" | "apple";
  createdAt: Timestamp;
  locale: "he" | "en";
  currency: string;
  notificationPrefs: NotificationPrefs;
  fcmTokens: string[];
  deletionRequestedAt: Timestamp | null;
}
