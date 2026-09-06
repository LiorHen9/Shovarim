// One-off seed for the consumer-club catalog: the clubs, and the card tiers
// offered under each. Both are writable only via the Admin SDK per
// firestore.rules (docs/DECISIONS.md ADR #61). Run with:
//   npm run seed:clubs                 (against local emulator, see .env.local)
//
// The write itself lives in src/lib/services/clubCatalog.ts, shared with the
// Playwright fixture so there is one flattening path, not two, and the data
// lives in src/lib/services/clubCatalogData.ts so the admin panel and a unit
// test can import it without seeding anything. This file is only the runner.
import { adminDb } from "../src/lib/firebase/adminApp";
import { seedClubCatalog } from "../src/lib/services/clubCatalog";
import { CATALOG } from "../src/lib/services/clubCatalogData";

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
