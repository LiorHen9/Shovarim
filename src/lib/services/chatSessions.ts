// Server-side conversation history for channels with no client to hold it
// (docs/ROADMAP.md Phase 5.5.b, docs/DECISIONS.md ADR #29 decision 7). The web
// chat keeps history in browser state and resends it every request (ADR #22);
// WhatsApp has no equivalent, so it lives in chatSessions/{channelKey}.
// Relative imports for the same reason as ./channelLinks.ts.
import { Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../firebase/adminApp";
import { trimHistory } from "../mcp/historyLimits";
import type { ChatSession } from "../../types/channelLink";

const SESSIONS = "chatSessions";

// A conversation nobody has touched for a day starts over. Two reasons, and
// either alone would justify it: WhatsApp's own 24-hour service window means a
// reply after that gap is a new conversation anyway, and unbounded retention
// of message text (financial PII in free prose — docs/PRIVACY.md) is exactly
// what we promised not to accumulate.
export const SESSION_MAX_IDLE_MS = 24 * 60 * 60 * 1000;

// Returns [] for a missing, stale, or unparseable session — every one of those
// is "start a fresh conversation", never an error the sender should see.
export async function loadChannelHistory<T>(channelKey: string, uid: string): Promise<T[]> {
  const snap = await adminDb.collection(SESSIONS).doc(channelKey).get();
  if (!snap.exists) return [];

  const session = snap.data() as ChatSession;

  // The link may have been moved to another account since the session was
  // written (redeemLinkCode overwrites an existing link on purpose). Serving
  // the previous owner's history to the new one would leak their data.
  if (session.uid !== uid) return [];
  if (Date.now() - session.updatedAt.toMillis() >= SESSION_MAX_IDLE_MS) return [];

  try {
    const parsed = JSON.parse(session.history);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function saveChannelHistory<T>(
  channelKey: string,
  uid: string,
  history: T[]
): Promise<void> {
  await adminDb
    .collection(SESSIONS)
    .doc(channelKey)
    .set({
      channelKey,
      uid,
      history: JSON.stringify(trimHistory(history)),
      updatedAt: Timestamp.now(),
    });
}

// Called when a channel is unlinked or an account is deleted — the history
// outlives neither.
export async function deleteChannelHistory(channelKey: string): Promise<void> {
  await adminDb.collection(SESSIONS).doc(channelKey).delete();
}

export interface ExportedChatSession {
  channelKey: string;
  updatedAt: string;
  history: unknown[];
}

// For the right-to-access export (docs/PRIVACY.md, Phase 4.1). Conversation
// text is the user's own data, so it belongs in the export — the placeholder
// comment in src/lib/services/export.ts asked for exactly this once anything
// wrote the collection. Parsed back into JSON rather than exported as an
// escaped string, so the file stays readable.
export async function listChatSessionsForUid(uid: string): Promise<ExportedChatSession[]> {
  const snap = await adminDb.collection(SESSIONS).where("uid", "==", uid).get();
  return snap.docs.map((doc) => {
    const session = doc.data() as ChatSession;
    let history: unknown[] = [];
    try {
      const parsed = JSON.parse(session.history);
      if (Array.isArray(parsed)) history = parsed;
    } catch {
      // A corrupt session exports as empty rather than failing the whole file.
    }
    return {
      channelKey: session.channelKey,
      updatedAt: session.updatedAt.toDate().toISOString(),
      history,
    };
  });
}
