// One-off migration: encrypts any `cards` document's cvv/barcodeOrCode that
// were written before src/lib/crypto/fieldEncryption.ts existed (plaintext).
// Idempotent — already-encrypted values (isEncryptedField) are left alone,
// so it's safe to re-run. See docs/SECURITY.md and docs/DECISIONS.md. Run
// once per environment after deploying the encryption code:
//   npm run migrate:encrypt-fields                (against .env.local, e.g. the emulator)
import { adminDb } from "../src/lib/firebase/adminApp";
import { encryptSensitiveField, isEncryptedField } from "../src/lib/crypto/fieldEncryptionCore";

const BATCH_SIZE = 400; // under Firestore's 500-write batch limit

async function main() {
  const cardsSnap = await adminDb.collection("cards").get();

  let scanned = 0;
  let migrated = 0;
  let batch = adminDb.batch();
  let pendingInBatch = 0;

  for (const doc of cardsSnap.docs) {
    scanned += 1;
    const data = doc.data();
    const update: Record<string, string> = {};

    const cvv: string | null = data.cvv ?? null;
    if (cvv && !isEncryptedField(cvv)) update.cvv = encryptSensitiveField(cvv);

    const barcodeOrCode: string | null = data.barcodeOrCode ?? null;
    if (barcodeOrCode && !isEncryptedField(barcodeOrCode)) {
      update.barcodeOrCode = encryptSensitiveField(barcodeOrCode);
    }

    if (Object.keys(update).length === 0) continue;

    batch.update(doc.ref, update);
    migrated += 1;
    pendingInBatch += 1;

    if (pendingInBatch >= BATCH_SIZE) {
      await batch.commit();
      batch = adminDb.batch();
      pendingInBatch = 0;
    }
  }

  if (pendingInBatch > 0) await batch.commit();

  console.log(`Scanned ${scanned} cards, encrypted sensitive fields on ${migrated}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
