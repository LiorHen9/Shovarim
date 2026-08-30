// AES-256-GCM application-level encryption for the two most sensitive card
// fields (cvv, barcodeOrCode) — a defense-in-depth layer beyond Firestore's
// at-rest encryption (see docs/SECURITY.md). No "server-only" import here on
// purpose, mirroring src/lib/firebase/adminApp.ts: scripts/ (plain tsx,
// outside Next's bundler) needs to import this directly for the migration
// script. Next.js app code must go through ./fieldEncryption.ts instead,
// which adds the "server-only" guard.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // NIST-recommended GCM nonce size
const KEY_LENGTH_BYTES = 32; // AES-256
const VERSION_PREFIX = "v1";

let cachedKey: Buffer | null = null;

// Parsed lazily (not at module load) so importing this module never requires
// CARD_FIELD_ENCRYPTION_KEY to be present at Next.js build time — only when a
// Server Action actually encrypts/decrypts a field at request time. Avoids
// repeating the apphosting.yaml BUILD-availability pitfall documented for the
// Admin SDK credentials in docs/DEPLOYMENT.md.
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CARD_FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CARD_FIELD_ENCRYPTION_KEY is not set — required to read or write cvv/barcodeOrCode (see .env.example)."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error("CARD_FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded AES-256 key).");
  }
  cachedKey = key;
  return key;
}

export function encryptSensitiveField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION_PREFIX, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

// Tolerates values written before this encryption layer existed: anything
// not tagged with the "v1:" version prefix is returned unchanged instead of
// being parsed as ciphertext, so un-migrated cards stay readable until
// scripts/migrate-encrypt-sensitive-fields.ts (or the next edit) re-encrypts
// them. New writes always go through encryptSensitiveField above.
export function decryptSensitiveField(value: string): string {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) return value;
  const [, ivB64, authTagB64, ciphertextB64] = parts as [string, string, string, string];
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function isEncryptedField(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 4 && parts[0] === VERSION_PREFIX;
}

export function encryptNullableField(value: string | null): string | null {
  return value === null || value === "" ? value : encryptSensitiveField(value);
}

// `undefined` is accepted, not just `null`: GiftCard declares cvv/barcodeOrCode
// as `string | null`, but a Firestore document written before those fields
// existed simply has no such key, and `doc.data() as GiftCard` hands back
// `undefined` with TypeScript none the wiser. That gap crashed the data export
// in production with "Cannot read properties of undefined (reading 'split')"
// (2026-08-30) — a plain TypeError, so toActionResult rethrew it and the
// Server Action answered 500. Normalizing here rather than at each call site
// keeps the next reader of a legacy document from rediscovering it.
export function decryptNullableField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value === "") return "";
  return decryptSensitiveField(value);
}
