// Admin-only mutations on the club catalog (docs/DECISIONS.md ADR #61,
// docs/ROADMAP.md Phase 10.1.b). Called only from src/actions/adminClubs.ts,
// which already ran requireAdmin() — these functions trust the adminUid they
// are given, same contract as adminModeration.ts.
//
// firestore.rules still says `allow write: if false` on clubs/clubCards. That
// is unchanged and deliberate: no browser writes the catalog, admin or not.
// These run in the Admin SDK, which bypasses Rules, behind a server-side role
// check — the same trust class as blocking a user.
import { randomUUID } from "node:crypto";

import { adminDb, adminStorage } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import { writeAdminAuditLog } from "../audit/adminLog";
import { seedClubCatalog } from "./clubCatalog";
import { CATALOG } from "./clubCatalogData";
import { validateClubLogo } from "../validation/club";
import type { ClubCardFormValues, ClubFormValues } from "../validation/club";
import type { Club } from "../../types/club";
import type { ClubCard } from "../../types/clubCard";

export interface AdminClubCard extends ClubCard {
  /** How many users say they hold this tier — what makes a delete unsafe. */
  membershipCount: number;
}

export interface AdminClub extends Club {
  cards: AdminClubCard[];
}

// Everything, including retired rows: the admin view is the one place that has
// to show what the members' page deliberately hides, otherwise a club switched
// off by mistake becomes invisible and unrecoverable through the UI.
export async function listCatalogForAdmin(): Promise<AdminClub[]> {
  const [clubsSnap, cardsSnap] = await Promise.all([
    adminDb.collection("clubs").get(),
    adminDb.collection("clubCards").get(),
  ]);

  const cards = cardsSnap.docs.map((doc) => ({ ...(doc.data() as Omit<ClubCard, "id">), id: doc.id }));

  // One count() aggregation per card rather than reading clubMemberships: that
  // collection grows with users, the number of tiers does not, and this page
  // only needs the number.
  const counts = await Promise.all(
    cards.map(async (card) => {
      const snap = await adminDb
        .collection("clubMemberships")
        .where("clubCardId", "==", card.id)
        .count()
        .get();
      return [card.id, snap.data().count] as const;
    })
  );
  const countById = new Map(counts);

  return clubsSnap.docs
    .map((doc) => {
      const club = { ...(doc.data() as Omit<Club, "id">), id: doc.id };
      return {
        ...club,
        // A doc written by an older seed has neither field — normalise here
        // rather than hand `undefined` to a controlled form input.
        logoUrl: club.logoUrl ?? null,
        website: club.website ?? null,
        cards: cards
          .filter((card) => card.clubId === doc.id)
          .map((card) => ({ ...card, membershipCount: countById.get(card.id) ?? 0 }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function upsertClub(adminUid: string, values: ClubFormValues): Promise<void> {
  const ref = adminDb.collection("clubs").doc(values.id);
  const existing = await ref.get();

  await writeAdminAuditLog({
    adminUid,
    targetId: values.id,
    action: "club_upsert",
    reason: existing.exists ? "update" : "create",
  });

  // A merge, not a plain set: logoUrl is owned by setClubLogo/clearClubLogo and
  // is not a field on this form, so set() would silently drop a club's logo
  // every time somebody fixed a typo in its description.
  await ref.set(
    {
      id: values.id,
      name: values.name,
      description: values.description,
      // "" is the form's way of saying "no site"; null is what ClubsGrid reads.
      website: values.website === "" ? null : values.website,
      color: values.color,
      isActive: values.isActive,
      sortOrder: values.sortOrder,
      ...(existing.exists ? {} : { logoUrl: null }),
    },
    { merge: true }
  );
}

export async function upsertClubCard(adminUid: string, values: ClubCardFormValues): Promise<void> {
  const clubSnap = await adminDb.collection("clubs").doc(values.clubId).get();
  if (!clubSnap.exists) throw new ActionError("המועדון לא קיים");

  const clubCardId = `${values.clubId}-${values.cardId}`;
  await writeAdminAuditLog({
    adminUid,
    targetId: clubCardId,
    action: "club_card_upsert",
  });

  await adminDb.collection("clubCards").doc(clubCardId).set({
    id: clubCardId,
    clubId: values.clubId,
    name: values.name,
    description: values.description,
    isActive: values.isActive,
    sortOrder: values.sortOrder,
  });
}

// Deleting a tier that people hold would orphan their clubMemberships: the
// holding stays in Firestore and in their data export (with null names, which
// the export already handles) but silently stops meaning anything, and nobody
// can tell them why. Retiring with isActive: false hides the tier from /clubs
// and keeps every holding intact, so that is the only option once a tier has
// holders.
async function assertNoMemberships(clubCardId: string): Promise<void> {
  const snap = await adminDb
    .collection("clubMemberships")
    .where("clubCardId", "==", clubCardId)
    .count()
    .get();
  const count = snap.data().count;
  if (count > 0) {
    throw new ActionError(`${count} משתמשים סימנו שהכרטיס הזה ברשותם — אפשר להשבית אותו, לא למחוק`);
  }
}

export async function deleteClubCard(adminUid: string, clubId: string, cardId: string): Promise<void> {
  const clubCardId = `${clubId}-${cardId}`;
  await assertNoMemberships(clubCardId);

  await writeAdminAuditLog({ adminUid, targetId: clubCardId, action: "club_card_delete" });
  await adminDb.collection("clubCards").doc(clubCardId).delete();
}

export async function deleteClub(adminUid: string, clubId: string): Promise<void> {
  const cardsSnap = await adminDb.collection("clubCards").where("clubId", "==", clubId).get();
  // Every tier is checked before anything is written, so a club with one held
  // tier and three empty ones is refused whole rather than half-deleted.
  for (const card of cardsSnap.docs) {
    await assertNoMemberships(card.id);
  }

  await writeAdminAuditLog({ adminUid, targetId: clubId, action: "club_delete" });

  const batch = adminDb.batch();
  for (const card of cardsSnap.docs) batch.delete(card.ref);
  batch.delete(adminDb.collection("clubs").doc(clubId));
  await batch.commit();

  await deleteLogoObject(clubId);
}

// --- logos -----------------------------------------------------------------

// One object per club, no extension: the club id alone keeps the path
// predictable, and replacing a logo becomes an overwrite rather than an orphan.
const logoPath = (clubId: string) => `clubLogos/${clubId}`;

// The same URL shape firebase/storage's getDownloadURL() produces, built by
// hand because the upload runs through the Admin SDK. A download token rather
// than makePublic(): making an object public is an ACL write, which fails
// outright on a bucket with uniform bucket-level access enabled, while a token
// works either way.
function downloadUrl(bucketName: string, path: string, token: string): string {
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const base = emulator
    ? `http://${emulator}/v0/b/${bucketName}/o`
    : `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o`;
  return `${base}/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export async function setClubLogo(
  adminUid: string,
  clubId: string,
  file: { buffer: Buffer; type: string; size: number }
): Promise<string> {
  // Re-validated here and not only in the browser: a Server Action is directly
  // POST-able with any payload, so the client-side check is a courtesy.
  const invalid = validateClubLogo(file);
  if (invalid) throw new ActionError(invalid);

  const clubRef = adminDb.collection("clubs").doc(clubId);
  if (!(await clubRef.get()).exists) throw new ActionError("המועדון לא קיים");

  await writeAdminAuditLog({ adminUid, targetId: clubId, action: "club_logo_set" });

  const bucket = adminStorage.bucket();
  const token = randomUUID();
  await bucket.file(logoPath(clubId)).save(file.buffer, {
    contentType: file.type,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  // A fresh token on every upload doubles as cache-busting: the object path is
  // stable, so without a changing query string a replaced logo would keep
  // being served from the browser cache.
  const url = downloadUrl(bucket.name, logoPath(clubId), token);
  await clubRef.update({ logoUrl: url });
  return url;
}

async function deleteLogoObject(clubId: string): Promise<void> {
  // ignoreNotFound: the seeded clubs point at a committed public/clubs/ file
  // and have no Storage object at all, and clearing their logo must not fail.
  await adminStorage.bucket().file(logoPath(clubId)).delete({ ignoreNotFound: true });
}

export async function clearClubLogo(adminUid: string, clubId: string): Promise<void> {
  await writeAdminAuditLog({ adminUid, targetId: clubId, action: "club_logo_clear" });
  await adminDb.collection("clubs").doc(clubId).update({ logoUrl: null });
  await deleteLogoObject(clubId);
}

// --- built-in catalog ------------------------------------------------------

// Applies src/lib/services/clubCatalogData.ts over whatever is there. This is
// how an empty environment — production, right after the first deploy — gets
// its catalog without anybody handling a service-account key, and how a
// mangled one gets restored.
//
// Overwrites the clubs it names, including admin edits to them, and leaves
// every other club and every clubMembership untouched.
export async function syncBuiltInCatalog(adminUid: string): Promise<{ clubs: number; cards: number }> {
  await writeAdminAuditLog({ adminUid, action: "club_catalog_sync" });
  return seedClubCatalog(adminDb, CATALOG);
}
