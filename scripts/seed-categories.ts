// One-off seed for system-default categories (ownerId: "system", writable
// only via the Admin SDK per firestore.rules). Run with:
//   npm run seed:categories            (against local emulator, see .env.local)
import { adminDb } from "../src/lib/firebase/adminApp";

const SYSTEM_CATEGORIES: Array<{ id: string; name: string; icon: string; color: string }> = [
  { id: "restaurants", name: "מסעדות", icon: "utensils", color: "#f97316" },
  { id: "shopping", name: "קניות וחנויות", icon: "shopping-bag", color: "#3b82f6" },
  { id: "gifts", name: "מתנות", icon: "gift", color: "#ec4899" },
  { id: "entertainment", name: "בילויים ופנאי", icon: "ticket", color: "#8b5cf6" },
  { id: "electronics", name: "מוצרי חשמל", icon: "plug", color: "#10b981" },
  { id: "other", name: "אחר", icon: "tag", color: "#6b7280" },
];

async function main() {
  const batch = adminDb.batch();
  for (const category of SYSTEM_CATEGORIES) {
    const ref = adminDb.collection("categories").doc(`system-${category.id}`);
    batch.set(ref, {
      id: `system-${category.id}`,
      ownerId: "system",
      name: category.name,
      icon: category.icon,
      color: category.color,
      isSystemDefault: true,
    });
  }
  await batch.commit();
  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system categories.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
