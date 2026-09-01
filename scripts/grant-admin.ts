// One-time admin-role bootstrap (docs/DECISIONS.md ADR #42). adminRoles/{uid}
// is Admin-SDK-only (firestore.rules) by design, so there is no UI path to
// create the first admin — this script is it. Idempotent: re-running for the
// same uid just overwrites grantedBy/grantedAt.
//   npm run grant-admin -- <uid>
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../src/lib/firebase/adminApp";

async function main() {
  const [, , uid] = process.argv;
  if (!uid) {
    console.error("Usage: npm run grant-admin -- <uid>");
    process.exit(1);
  }

  await adminDb.doc(`adminRoles/${uid}`).set({
    uid,
    role: "super_admin",
    grantedBy: "system",
    grantedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Granted super_admin to ${uid}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
