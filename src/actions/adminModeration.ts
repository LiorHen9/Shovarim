"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import {
  blockUserSchema,
  blockEmailActionSchema,
  blockPhoneActionSchema,
  blockUidSchema,
  blockEmailSchema,
  blockPhoneSchema,
  type BlockUserInput,
  type BlockEmailInput,
  type BlockPhoneInput,
} from "@/lib/validation/moderation";
import * as adminModeration from "@/lib/services/adminModeration";

// Thin wrappers (requireAdmin() + Zod + call the service), same shape as
// every other src/actions/*.ts — the actual mutations, including the
// self-protection check, live in src/lib/services/adminModeration.ts.

export async function blockUserAction(input: BlockUserInput): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const { uid, reason } = blockUserSchema.parse(input);
    await adminModeration.blockUser(adminUid, uid, reason);
    revalidatePath(`/admin/users/${uid}`);
    return { success: true };
  });
}

export async function unblockUserAction(uid: string): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsedUid = blockUidSchema.parse(uid);
    await adminModeration.unblockUser(adminUid, parsedUid);
    revalidatePath(`/admin/users/${parsedUid}`);
    return { success: true };
  });
}

export async function blockEmailAction(input: BlockEmailInput): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const { email, reason } = blockEmailActionSchema.parse(input);
    await adminModeration.blockEmail(adminUid, email, reason);
    return { success: true };
  });
}

export async function unblockEmailAction(email: string): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsedEmail = blockEmailSchema.parse(email);
    await adminModeration.unblockEmail(adminUid, parsedEmail);
    return { success: true };
  });
}

export async function blockPhoneAction(input: BlockPhoneInput): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const { phone, reason } = blockPhoneActionSchema.parse(input);
    await adminModeration.blockPhone(adminUid, phone, reason);
    return { success: true };
  });
}

export async function unblockPhoneAction(phone: string): Promise<ActionResult<{ success: true }>> {
  return toActionResult(async () => {
    const adminUid = await requireAdmin();
    const parsedPhone = blockPhoneSchema.parse(phone);
    await adminModeration.unblockPhone(adminUid, parsedPhone);
    return { success: true };
  });
}
