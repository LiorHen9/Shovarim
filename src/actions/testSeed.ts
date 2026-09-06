"use server";

import { adminDb } from "@/lib/firebase/admin";
import { seedClubCatalog, type SeedClub } from "@/lib/services/clubCatalog";

// Playwright-only helper, hard-guarded to the emulator exactly like
// mintTestCustomToken in src/actions/testAuth.ts (docs/DECISIONS.md #18). The
// clubs/clubCards catalog is Admin-SDK-only by design, so a test cannot create
// it through the UI the way it creates cards.
//
// A fixture rather than the real catalog from scripts/seed-clubs.ts: the test
// asserts that tiers under one club are independent, and it should not start
// failing the day someone adds a club or renames a tier in production data.
const TEST_CATALOG: SeedClub[] = [
  {
    id: "e2e-multi",
    name: "מועדון בדיקה רב-כרטיסים",
    description: "מועדון לבדיקות אוטומטיות.",
    website: "https://example.com",
    color: "#0ea5e9",
    cards: [
      { id: "regular", name: "רגיל", description: "" },
      { id: "vip", name: "VIP", description: "הדרג הגבוה" },
    ],
  },
  {
    id: "e2e-single",
    name: "מועדון בדיקה חד-כרטיסי",
    description: "",
    website: "https://example.com",
    color: "#16a34a",
    cards: [{ id: "regular", name: "רגיל", description: "" }],
  },
];

export async function seedTestClubCatalog(): Promise<void> {
  if (process.env.FIREBASE_USE_EMULATOR !== "true") {
    throw new Error("seedTestClubCatalog is only available against the Firebase emulator");
  }

  await seedClubCatalog(adminDb, TEST_CATALOG);
}
