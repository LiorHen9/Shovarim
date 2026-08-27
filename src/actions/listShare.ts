"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUid } from "@/lib/auth/session";
import { ActionError, toActionResult, type ActionResult } from "@/lib/actions/errors";
import { inviteListMemberSchema, type InviteListMemberInput } from "@/lib/validation/cardListMember";

// Invitations are resolved by email through the Admin SDK Auth lookup — there's
// no client-safe way to find another user's uid by email, and exposing that
// lookup as a raw client query would let anyone probe which emails have
// accounts. See docs/DECISIONS.md #15.
export async function inviteListMember(
  input: InviteListMemberInput
): Promise<ActionResult<{ memberUid: string }>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    const parsed = inviteListMemberSchema.parse(input);

    const listRef = adminDb.collection("cardLists").doc(parsed.listId);
    const listSnap = await listRef.get();
    if (!listSnap.exists) throw new ActionError("הרשימה לא נמצאה");

    const list = listSnap.data();
    if (!list || list.ownerId !== uid) throw new ActionError("רק בעל הרשימה יכול לשתף אותה");

    let targetUid: string;
    try {
      const targetUser = await adminAuth.getUserByEmail(parsed.email);
      targetUid = targetUser.uid;
    } catch {
      throw new ActionError("לא נמצא משתמש רשום עם כתובת אימייל זו");
    }

    if (targetUid === uid) throw new ActionError("אי אפשר לשתף רשימה עם עצמך");

    const memberRef = listRef.collection("members").doc(targetUid);
    const memberSnap = await memberRef.get();
    if (memberSnap.exists) throw new ActionError("המשתמש כבר משותף ברשימה זו");

    await memberRef.set({
      id: targetUid,
      listId: parsed.listId,
      memberUid: targetUid,
      email: parsed.email,
      role: parsed.role,
      status: "pending",
      invitedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(`/cards/lists/${parsed.listId}`);
    return { memberUid: targetUid };
  });
}
