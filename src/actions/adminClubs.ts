"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { ActionError, toActionResult, type ActionResult } from "@/lib/actions/errors";
import {
  clubCardFormSchema,
  clubCardIdSchema,
  clubFormSchema,
  clubIdOnlySchema,
  clubSlugSchema,
  type ClubCardFormValues,
  type ClubFormValues,
} from "@/lib/validation/club";
import * as adminClubs from "@/lib/services/adminClubs";

// Thin wrappers (requireAdmin() + Zod + call the service), same shape as
// src/actions/adminModeration.ts — the mutations themselves, including the
// "cannot delete a tier people hold" rule, live in
// src/lib/services/adminClubs.ts.
//
// Both /admin/clubs and /clubs are revalidated on every write: the members'
// page reads the catalog through onSnapshot and updates itself, but its
// server-rendered shell is cached like any other route.
function revalidateCatalog() {
  revalidatePath("/admin/clubs");
  revalidatePath("/clubs");
}

export async function upsertClubAction(input: ClubFormValues): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    await adminClubs.upsertClub(adminUid, clubFormSchema.parse(input));
    revalidateCatalog();
    return { success: true };
  });
}

export async function deleteClubAction(clubId: string): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsed = clubIdOnlySchema.parse({ clubId });
    await adminClubs.deleteClub(adminUid, parsed.clubId);
    revalidateCatalog();
    return { success: true };
  });
}

export async function upsertClubCardAction(
  input: ClubCardFormValues
): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    await adminClubs.upsertClubCard(adminUid, clubCardFormSchema.parse(input));
    revalidateCatalog();
    return { success: true };
  });
}

export async function deleteClubCardAction(
  clubId: string,
  cardId: string
): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsed = clubCardIdSchema.parse({ clubId, cardId });
    await adminClubs.deleteClubCard(adminUid, parsed.clubId, parsed.cardId);
    revalidateCatalog();
    return { success: true };
  });
}

// FormData rather than a typed input, because the payload is a file. The
// upload deliberately does not go through firebase/storage from the browser:
// storage.rules keeps clubLogos/ at `allow write: if false` so that no client
// can write a catalog asset, which means the bytes have to arrive here and be
// written with the Admin SDK.
export async function setClubLogoAction(formData: FormData): Promise<ActionResult<{ logoUrl: string }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const clubId = clubSlugSchema.parse(formData.get("clubId"));

    const file = formData.get("logo");
    if (!(file instanceof File)) throw new ActionError("לא נבחר קובץ");

    const logoUrl = await adminClubs.setClubLogo(adminUid, clubId, {
      buffer: Buffer.from(await file.arrayBuffer()),
      type: file.type,
      size: file.size,
    });
    revalidateCatalog();
    return { logoUrl };
  });
}

export async function clearClubLogoAction(clubId: string): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsed = clubIdOnlySchema.parse({ clubId });
    await adminClubs.clearClubLogo(adminUid, parsed.clubId);
    revalidateCatalog();
    return { success: true };
  });
}

export async function syncBuiltInCatalogAction(): Promise<
  ActionResult<{ clubs: number; cards: number }>
> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const result = await adminClubs.syncBuiltInCatalog(adminUid);
    revalidateCatalog();
    return result;
  });
}
