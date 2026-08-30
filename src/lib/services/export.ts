import type { Timestamp } from "firebase/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { decryptNullableField } from "@/lib/crypto/fieldEncryption";
import type { UserProfile, NotificationPrefs } from "@/types/user";
import type { Consent } from "@/types/consent";
import type { CardList } from "@/types/cardList";
import type { CardListMember, ListMemberRole, ListMemberStatus } from "@/types/cardListMember";
import type { GiftCard, CardStatus } from "@/types/card";
import type { UsageLogEntry } from "@/types/usageLog";
import type { Category } from "@/types/category";
import type { ChannelLinkSummary } from "@/types/channelLink";
import { listChannelLinksForUid } from "@/lib/services/channelLinks";
import { listChatSessionsForUid, type ExportedChatSession } from "@/lib/services/chatSessions";

function toIso(value: Timestamp | null | undefined): string | null {
  return value ? value.toDate().toISOString() : null;
}

interface SerializedCardList {
  id: string;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  members: Array<{
    memberUid: string;
    email: string;
    role: ListMemberRole;
    status: ListMemberStatus;
    createdAt: string | null;
  }>;
}

interface SerializedListMembership {
  listId: string;
  role: ListMemberRole;
  status: ListMemberStatus;
  createdAt: string | null;
}

interface SerializedUsageLogEntry {
  id: string;
  amount: number;
  date: string | null;
  purpose: string;
  location: string | null;
  receiptImageUrl: string | null;
  balanceAfter: number;
  createdAt: string | null;
  createdBy: string;
}

interface SerializedCard {
  id: string;
  listId: string;
  name: string;
  categoryId: string | null;
  tags: string[];
  initialBalance: number;
  currentBalance: number;
  currency: string;
  expiryDate: string | null;
  purchaseDate: string | null;
  cardImageUrl: string | null;
  barcodeOrCode: string | null;
  cvv: string | null;
  acceptingRetailersUrl: string | null;
  notes: string | null;
  status: CardStatus;
  createdAt: string | null;
  updatedAt: string | null;
  usageLog: SerializedUsageLogEntry[];
}

export interface UserDataExport {
  exportedAt: string;
  profile: {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    authProvider: "google" | "apple";
    createdAt: string | null;
    locale: "he" | "en";
    currency: string;
    notificationPrefs: NotificationPrefs;
    fcmTokens: string[];
    deletionRequestedAt: string | null;
  } | null;
  consent: {
    privacyPolicyVersion: string;
    acceptedAt: string | null;
    marketingConsent: boolean;
  } | null;
  cardLists: SerializedCardList[];
  listMemberships: SerializedListMembership[];
  cards: SerializedCard[];
  categories: Category[];
  // Phase 5.5 (ADR #29). Keyed by channelKey rather than uid, so it is not
  // reachable through the ownership queries above and needs its own pass — the
  // same reason functions/src/accountDeletion.ts queries it separately.
  // Unredeemed link codes are deliberately excluded: they are live bearer
  // credentials, and an export file is exactly the artifact that gets emailed
  // around. chatSessions, written since Phase 5.5.b, is included — the
  // conversation text is the user's own data.
  channelLinks: ChannelLinkSummary[];
  chatSessions: ExportedChatSession[];
}

// Right-to-access/portability export (docs/PRIVACY.md, docs/ROADMAP.md Phase
// 4). Scoped to data this uid owns or was personally invited into — not data
// belonging to other users that this uid merely has shared-list read access
// to. Unlike the MCP tool serialization (mcp-server/index.ts), cvv/
// barcodeOrCode are included here: this is the user's own data going back to
// themselves, not data handed to an LLM. They're stored encrypted
// (src/lib/crypto/fieldEncryption.ts) and decrypted below so the exported
// JSON is human-readable, not ciphertext.
export async function buildUserDataExport(uid: string): Promise<UserDataExport> {
  const [userSnap, consentSnap, ownedListsSnap, membershipsSnap, ownedCardsSnap, categoriesSnap] =
    await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("consents").doc(uid).get(),
      adminDb.collection("cardLists").where("ownerId", "==", uid).get(),
      // No status filter, unlike every other members query (useCardLists,
      // usePendingInvitations, cardLists.ts, cards.ts) — an export owes the
      // user their pending invitations too, not just accepted ones. That makes
      // it a single-field collection-group query, and Firestore does NOT create
      // those automatically the way it does for collection scope: it needs the
      // explicit COLLECTION_GROUP override on members.memberUid in
      // firestore.indexes.json. Without it every export failed in production
      // with FAILED_PRECONDITION while the emulator passed, because the
      // emulator invents an index for whatever it is asked (ADR #33).
      adminDb.collectionGroup("members").where("memberUid", "==", uid).get(),
      adminDb.collection("cards").where("ownerId", "==", uid).get(),
      adminDb.collection("categories").where("ownerId", "==", uid).get(),
    ]);

  const profile = userSnap.exists
    ? (() => {
        const user = userSnap.data() as UserProfile;
        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          authProvider: user.authProvider,
          createdAt: toIso(user.createdAt),
          locale: user.locale,
          currency: user.currency,
          notificationPrefs: user.notificationPrefs,
          fcmTokens: user.fcmTokens,
          deletionRequestedAt: toIso(user.deletionRequestedAt),
        };
      })()
    : null;

  const consent = consentSnap.exists
    ? (() => {
        const data = consentSnap.data() as Consent;
        return {
          privacyPolicyVersion: data.privacyPolicyVersion,
          acceptedAt: toIso(data.acceptedAt),
          marketingConsent: data.marketingConsent,
        };
      })()
    : null;

  const cardLists = await Promise.all(
    ownedListsSnap.docs.map(async (listDoc): Promise<SerializedCardList> => {
      const list = listDoc.data() as CardList;
      const membersSnap = await listDoc.ref.collection("members").get();
      return {
        id: listDoc.id,
        name: list.name,
        createdAt: toIso(list.createdAt),
        updatedAt: toIso(list.updatedAt),
        members: membersSnap.docs.map((memberDoc) => {
          const member = memberDoc.data() as CardListMember;
          return {
            memberUid: member.memberUid,
            email: member.email,
            role: member.role,
            status: member.status,
            createdAt: toIso(member.createdAt),
          };
        }),
      };
    })
  );

  const ownedListIds = new Set(ownedListsSnap.docs.map((doc) => doc.id));
  const listMemberships: SerializedListMembership[] = membershipsSnap.docs
    .map((doc) => doc.data() as CardListMember)
    .filter((member) => !ownedListIds.has(member.listId))
    .map((member) => ({
      listId: member.listId,
      role: member.role,
      status: member.status,
      createdAt: toIso(member.createdAt),
    }));

  const cards = await Promise.all(
    ownedCardsSnap.docs.map(async (cardDoc): Promise<SerializedCard> => {
      const card = cardDoc.data() as GiftCard;
      const usageSnap = await cardDoc.ref.collection("usageLog").orderBy("date", "desc").get();
      return {
        id: cardDoc.id,
        listId: card.listId,
        name: card.name,
        categoryId: card.categoryId,
        tags: card.tags,
        initialBalance: card.initialBalance,
        currentBalance: card.currentBalance,
        currency: card.currency,
        expiryDate: toIso(card.expiryDate),
        purchaseDate: toIso(card.purchaseDate),
        cardImageUrl: card.cardImageUrl,
        barcodeOrCode: decryptNullableField(card.barcodeOrCode),
        cvv: decryptNullableField(card.cvv),
        acceptingRetailersUrl: card.acceptingRetailersUrl,
        notes: card.notes,
        status: card.status,
        createdAt: toIso(card.createdAt),
        updatedAt: toIso(card.updatedAt),
        usageLog: usageSnap.docs.map((entryDoc): SerializedUsageLogEntry => {
          const entry = entryDoc.data() as UsageLogEntry;
          return {
            id: entryDoc.id,
            amount: entry.amount,
            date: toIso(entry.date),
            purpose: entry.purpose,
            location: entry.location,
            receiptImageUrl: entry.receiptImageUrl,
            balanceAfter: entry.balanceAfter,
            createdAt: toIso(entry.createdAt),
            createdBy: entry.createdBy,
          };
        }),
      };
    })
  );

  // The doc id, not any `id` field inside the document: scripts/seed-categories.ts
  // writes an `id` for the system defaults, but CreateCategoryDialog uses addDoc
  // and writes none — so user-created categories exported as raw data() came out
  // with `id: undefined`, which JSON.stringify then dropped entirely.
  const categories: Category[] = categoriesSnap.docs.map((doc) => ({
    ...(doc.data() as Omit<Category, "id">),
    id: doc.id,
  }));
  const channelLinks = await listChannelLinksForUid(uid);
  const chatSessions = await listChatSessionsForUid(uid);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    consent,
    cardLists,
    listMemberships,
    cards,
    categories,
    channelLinks,
    chatSessions,
  };
}
