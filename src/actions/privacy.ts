"use server";

import { requireUid } from "@/lib/auth/session";
import { toActionResult, type ActionResult } from "@/lib/actions/errors";
import { buildUserDataExport, type UserDataExport } from "@/lib/services/export";
import { writeAuditLog } from "@/lib/audit/log";

// Right-to-access/portability (docs/PRIVACY.md, docs/ROADMAP.md Phase 4).
// uid is derived from the session only, never accepted as an argument.
export async function exportUserData(): Promise<ActionResult<UserDataExport>> {
  return toActionResult(async () => {
    const uid = await requireUid();
    try {
      const data = await buildUserDataExport(uid);
      await writeAuditLog({ uid, eventType: "export", channel: "web", result: "success" });
      return data;
    } catch (error) {
      await writeAuditLog({ uid, eventType: "export", channel: "web", result: "error" });
      throw error;
    }
  });
}
