// One-off seed for the consumer-club catalog: the clubs, and the card tiers
// offered under each. Both are writable only via the Admin SDK per
// firestore.rules (docs/DECISIONS.md ADR #61). Run with:
//   npm run seed:clubs                 (against local emulator, see .env.local)
//
// The write itself lives in src/lib/services/clubCatalog.ts, shared with the
// Playwright fixture so there is one flattening path, not two. This file is
// just the data.
import { adminDb } from "../src/lib/firebase/adminApp";
import { seedClubCatalog, type SeedClub } from "../src/lib/services/clubCatalog";

const CATALOG: SeedClub[] = [
  {
    id: "mifal-hapais",
    name: "מועדון מפעל הפיס",
    description: "מועדון ההטבות של מפעל הפיס.",
    website: "https://www.pais.co.il",
    color: "#0ea5e9",
    cards: [
      { id: "regular", name: "רגיל", description: "" },
      { id: "vip", name: "VIP", description: "" },
    ],
  },
  {
    id: "behatzdaa",
    name: "בהצדעה",
    description: "מועדון ההטבות לחיילים, משרתי מילואים וכוחות הביטחון.",
    website: "https://www.behatzdaa.org.il",
    color: "#16a34a",
    cards: [{ id: "regular", name: "רגיל", description: "" }],
  },
];

async function main() {
  const { clubs, cards } = await seedClubCatalog(adminDb, CATALOG);
  console.log(`Seeded ${clubs} clubs and ${cards} club cards.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
