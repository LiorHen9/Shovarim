// Blocking enforcement reads (docs/ROADMAP.md Phase 9.3, docs/DECISIONS.md
// ADR #44). Relative imports for the same reason as ./cards.ts: this is
// called from scripts/mcp-cli.ts and the WhatsApp path, both running under
// tsx outside Next's bundler.
//
// Auth disable+revoke is the primary enforcement mechanism (adminModeration.ts):
// verifySessionCookie(cookie, true) — already used by getSessionUid — checks
// both disabled and revocation, so every session-based entry point (web,
// mcp-cli) is covered automatically the moment an admin blocks a uid. The
// functions here are the fallback for WhatsApp, where the uid is derived
// from channelLinks with no Auth token at all (ADR #29) — and a second,
// cheap gate everywhere else, called right before the entry point would
// otherwise spend a Claude API call.
import { adminDb } from "../firebase/adminApp";
import { ActionError } from "../actions/errorsCore";
import type { UserModerationDoc } from "../../types/userModeration";

export interface ModerationStatus {
  blocked: boolean;
  reason: string | null;
}

export async function getUserModerationStatus(uid: string): Promise<ModerationStatus> {
  const snap = await adminDb.collection("userModeration").doc(uid).get();
  if (!snap.exists) return { blocked: false, reason: null };
  const data = snap.data() as UserModerationDoc;
  return { blocked: data.blocked, reason: data.blockedReason };
}

// Called at every entry point that reaches runAgentTurn (POST /api/chat,
// handleInboundChannelMessage, scripts/mcp-cli.ts), immediately after the uid
// is known and before any Claude call.
export async function assertNotBlocked(uid: string): Promise<void> {
  const status = await getUserModerationStatus(uid);
  if (status.blocked) throw new ActionError("החשבון חסום");
}

export async function isEmailBlocked(email: string): Promise<boolean> {
  const snap = await adminDb.collection("blockedEmails").doc(email).get();
  return snap.exists;
}

export async function isPhoneBlocked(phone: string): Promise<boolean> {
  const snap = await adminDb.collection("blockedPhones").doc(phone).get();
  return snap.exists;
}
