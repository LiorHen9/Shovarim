import { z } from "zod";

import { firestoreIdSchema } from "./card";

// Search box on /admin/users accepts one free-text field; which lookup runs
// is decided by shape (contains "@" → email via adminAuth.getUserByEmail,
// otherwise treated as a uid) rather than a second control, per
// docs/ROADMAP.md Phase 9.2. Both schemas normalize the same way their
// canonical counterparts elsewhere in the app do (trim, lowercase email) so
// a query built from a copy-pasted uid/email always matches what was stored.
export const adminUserSearchEmailSchema = z.string().trim().toLowerCase().email("כתובת אימייל לא תקינה");

export const adminUserSearchUidSchema = firestoreIdSchema;

// Pagination cursor on /admin/users: the last row's uid from the previous
// page (see listUsersPage in src/lib/services/adminUsers.ts for why a plain
// doc id is enough to seek Firestore's startAfter cursor). Reuses the same
// id shape as every other Firestore doc id in this app.
export const adminUsersCursorSchema = firestoreIdSchema;
