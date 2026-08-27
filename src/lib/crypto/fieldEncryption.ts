import "server-only";

// Never import this module from a Client Component — the key must never
// reach the browser. Standalone Node scripts (scripts/) import
// ./fieldEncryptionCore directly instead, same split as
// src/lib/firebase/admin.ts vs adminApp.ts.
export {
  encryptSensitiveField,
  decryptSensitiveField,
  encryptNullableField,
  decryptNullableField,
  isEncryptedField,
} from "./fieldEncryptionCore";
