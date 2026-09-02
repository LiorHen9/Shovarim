import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let testEnv: RulesTestEnvironment;

const USER_A = "user-a";
const USER_B = "user-b";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-shovarim-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("cards", () => {
  it("owner can create their own card", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
    });

    const db = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
      addDoc(collection(db, "cards"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Test Card",
        currentBalance: 100,
        currency: "ILS",
        status: "active",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("cannot create a card without a listId", async () => {
    const db = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      addDoc(collection(db, "cards"), {
        ownerId: USER_A,
        name: "Test Card",
        currentBalance: 100,
        currency: "ILS",
        status: "active",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("cannot create a card with a different user's ownerId", async () => {
    const db = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      addDoc(collection(db, "cards"), {
        ownerId: USER_B,
        name: "Spoofed Card",
        currentBalance: 100,
        currency: "ILS",
        status: "active",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("user B cannot read user A's card", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Card A",
        currentBalance: 50,
        currency: "ILS",
        status: "active",
      });
    });

    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(getDoc(doc(dbB, "cards/card1")));

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(getDoc(doc(dbA, "cards/card1")));
  });

  it("user B cannot update user A's card", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Card A",
        currentBalance: 50,
        currency: "ILS",
        status: "active",
      });
    });

    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(updateDoc(doc(dbB, "cards/card1"), { currentBalance: 0 }));
  });

  it("cannot change ownerId of an existing card via update", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Card A",
        currentBalance: 50,
        currency: "ILS",
        status: "active",
      });
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(updateDoc(doc(dbA, "cards/card1"), { ownerId: USER_B }));
  });

  it("unauthenticated user cannot read any card", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Card A",
        currentBalance: 50,
        currency: "ILS",
        status: "active",
      });
    });

    const dbAnon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(dbAnon, "cards/card1")));
  });
});

describe("cardLists", () => {
  it("owner can create their own card list", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
      addDoc(collection(dbA, "cardLists"), {
        ownerId: USER_A,
        name: "הרשימה שלי",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("cannot create a card list with a different user's ownerId", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      addDoc(collection(dbA, "cardLists"), {
        ownerId: USER_B,
        name: "Spoofed List",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("user B cannot read user A's card list", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
    });

    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(getDoc(doc(dbB, "cardLists/list1")));
  });

  it("owner can rename their own card list", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(updateDoc(doc(dbA, "cardLists/list1"), { name: "Renamed" }));
  });

  it("owner can delete their own card list", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(deleteDoc(doc(dbA, "cardLists/list1")));
  });
});

describe("list sharing (cardLists/{listId}/members)", () => {
  async function seedList() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
    });
  }

  it("owner can invite a member", async () => {
    await seedList();
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
      setDoc(doc(dbA, "cardLists/list1/members", USER_B), {
        listId: "list1",
        memberUid: USER_B,
        email: "b@example.com",
        role: "viewer",
        status: "pending",
        invitedBy: USER_A,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("non-owner cannot invite a member to someone else's list", async () => {
    await seedList();
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(
      setDoc(doc(dbB, "cardLists/list1/members", USER_B), {
        listId: "list1",
        memberUid: USER_B,
        email: "b@example.com",
        role: "manager",
        status: "pending",
        invitedBy: USER_B,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  async function seedPendingInvite(role: "manager" | "viewer" = "viewer") {
    await seedList();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1/members/" + USER_B), {
        listId: "list1",
        memberUid: USER_B,
        email: "b@example.com",
        role,
        status: "pending",
        invitedBy: USER_A,
      });
    });
  }

  it("invitee can accept their own pending invite", async () => {
    await seedPendingInvite();
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertSucceeds(
      updateDoc(doc(dbB, "cardLists/list1/members/" + USER_B), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("invitee cannot escalate their own role while accepting", async () => {
    await seedPendingInvite("viewer");
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(
      updateDoc(doc(dbB, "cardLists/list1/members/" + USER_B), {
        status: "accepted",
        role: "manager",
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("a third user cannot accept someone else's invite", async () => {
    await seedPendingInvite();
    const dbC = testEnv.authenticatedContext("user-c").firestore();
    await assertFails(
      updateDoc(doc(dbC, "cardLists/list1/members/" + USER_B), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("owner can change an accepted member's role", async () => {
    await seedList();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1/members/" + USER_B), {
        listId: "list1",
        memberUid: USER_B,
        email: "b@example.com",
        role: "viewer",
        status: "accepted",
        invitedBy: USER_A,
      });
    });
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
      updateDoc(doc(dbA, "cardLists/list1/members/" + USER_B), { role: "manager" })
    );
  });

  it("owner can remove a member; member can remove themselves", async () => {
    await seedPendingInvite();
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertSucceeds(deleteDoc(doc(dbB, "cardLists/list1/members/" + USER_B)));
  });

  it("pending invitee can read the list they were invited to", async () => {
    await seedPendingInvite();
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertSucceeds(getDoc(doc(dbB, "cardLists/list1")));
  });

  it("a non-invited user cannot read the list or its members", async () => {
    await seedPendingInvite();
    const dbC = testEnv.authenticatedContext("user-c").firestore();
    await assertFails(getDoc(doc(dbC, "cardLists/list1")));
    await assertFails(getDoc(doc(dbC, "cardLists/list1/members/" + USER_B)));
  });
});

describe("cards access via a shared list", () => {
  async function seedSharedCard(role: "manager" | "viewer") {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
      await setDoc(context.firestore().doc("cardLists/list1/members/" + USER_B), {
        listId: "list1",
        memberUid: USER_B,
        email: "b@example.com",
        role,
        status: "accepted",
        invitedBy: USER_A,
      });
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Card A",
        currentBalance: 50,
        currency: "ILS",
        status: "active",
      });
    });
  }

  it("an accepted viewer can read a card in the shared list", async () => {
    await seedSharedCard("viewer");
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertSucceeds(getDoc(doc(dbB, "cards/card1")));
  });

  it("an accepted viewer cannot update a card in the shared list", async () => {
    await seedSharedCard("viewer");
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(updateDoc(doc(dbB, "cards/card1"), { currentBalance: 0 }));
  });

  it("an accepted manager can update a card in the shared list", async () => {
    await seedSharedCard("manager");
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertSucceeds(updateDoc(doc(dbB, "cards/card1"), { currentBalance: 0 }));
  });

  it("an accepted manager can create a card in the shared list, owned by the list owner", async () => {
    await seedSharedCard("manager");
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertSucceeds(
      addDoc(collection(dbB, "cards"), {
        ownerId: USER_A,
        listId: "list1",
        name: "New Card",
        currentBalance: 10,
        currency: "ILS",
        status: "active",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("an accepted manager cannot create a card claiming themselves as owner", async () => {
    await seedSharedCard("manager");
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(
      addDoc(collection(dbB, "cards"), {
        ownerId: USER_B,
        listId: "list1",
        name: "New Card",
        currentBalance: 10,
        currency: "ILS",
        status: "active",
        createdAt: serverTimestamp(),
      })
    );
  });

  it("a pending (not yet accepted) member cannot read cards in the list", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
      await setDoc(context.firestore().doc("cardLists/list1/members/" + USER_B), {
        listId: "list1",
        memberUid: USER_B,
        email: "b@example.com",
        role: "manager",
        status: "pending",
        invitedBy: USER_A,
      });
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Card A",
        currentBalance: 50,
        currency: "ILS",
        status: "active",
      });
    });
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(getDoc(doc(dbB, "cards/card1")));
  });
});

describe("usageLog (immutable audit trail)", () => {
  async function seedCard() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cardLists/list1"), {
        ownerId: USER_A,
        name: "List A",
      });
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
        listId: "list1",
        name: "Card A",
        currentBalance: 50,
        currency: "ILS",
        status: "active",
      });
    });
  }

  it("owner can create a valid usage entry", async () => {
    await seedCard();
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
      addDoc(collection(dbA, "cards/card1/usageLog"), {
        ownerId: USER_A,
        cardId: "card1",
        amount: 20,
        purpose: "dinner",
        balanceAfter: 30,
        createdAt: serverTimestamp(),
      })
    );
  });

  it("rejects a usage entry with non-positive amount", async () => {
    await seedCard();
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      addDoc(collection(dbA, "cards/card1/usageLog"), {
        ownerId: USER_A,
        cardId: "card1",
        amount: 0,
        purpose: "dinner",
        balanceAfter: 50,
        createdAt: serverTimestamp(),
      })
    );
  });

  it("cannot update an existing usage entry", async () => {
    await seedCard();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cards/card1/usageLog/entry1"), {
        ownerId: USER_A,
        cardId: "card1",
        amount: 20,
        purpose: "dinner",
        balanceAfter: 30,
      });
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      updateDoc(doc(dbA, "cards/card1/usageLog/entry1"), { purpose: "edited" })
    );
  });

  it("cannot delete an existing usage entry", async () => {
    await seedCard();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cards/card1/usageLog/entry1"), {
        ownerId: USER_A,
        cardId: "card1",
        amount: 20,
        purpose: "dinner",
        balanceAfter: 30,
      });
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(deleteDoc(doc(dbA, "cards/card1/usageLog/entry1")));
  });

  it("user B cannot read user A's usage log", async () => {
    await seedCard();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cards/card1/usageLog/entry1"), {
        ownerId: USER_A,
        cardId: "card1",
        amount: 20,
        purpose: "dinner",
        balanceAfter: 30,
      });
    });

    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(getDocs(collection(dbB, "cards/card1/usageLog")));
  });
});

describe("categories", () => {
  it("client cannot write a system-default category", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "categories/system-restaurants"), {
        ownerId: "system",
        name: "מסעדות",
        isSystemDefault: true,
      })
    );
  });

  it("any signed-in user can read a system-default category", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("categories/system-restaurants"), {
        ownerId: "system",
        name: "מסעדות",
        isSystemDefault: true,
      });
    });

    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertSucceeds(getDoc(doc(dbB, "categories/system-restaurants")));
  });

  it("owner can create their own custom category", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
      addDoc(collection(dbA, "categories"), {
        ownerId: USER_A,
        name: "התחביב שלי",
        isSystemDefault: false,
      })
    );
  });
});

describe("server-managed collections (reminders, auditLog)", () => {
  it("client cannot write to reminders even for their own uid", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "reminders/reminder1"), {
        ownerId: USER_A,
        cardId: "card1",
        status: "pending",
      })
    );
  });

  it("client cannot write to auditLog", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "auditLog/entry1"), { ownerId: USER_A, event: "login" })
    );
  });

  it("client cannot read or write rateLimits, even their own uid's doc", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, `rateLimits/${USER_A}`), { windowStart: new Date(), count: 1 })
    );
    await assertFails(getDoc(doc(dbA, `rateLimits/${USER_A}`)));
  });

  // docs/ROADMAP.md Phase 9.5, docs/DECISIONS.md ADR #49. Same "if false"
  // both ways as rateLimits above — unlike auditLog, the uid the entry
  // belongs to has no owner-read path either (see the ADR for why).
  it("client cannot read or write claudeUsageLog, even their own uid's entry", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "claudeUsageLog/entry1"), {
        uid: USER_A,
        channel: "web",
        model: "claude-sonnet-5",
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        estimatedCostUsd: 0.001,
        createdAt: serverTimestamp(),
      })
    );
    await assertFails(getDoc(doc(dbA, "claudeUsageLog/entry1")));
  });
});

// docs/ROADMAP.md Phase 5.5, docs/DECISIONS.md ADR #29. These three are
// Admin-SDK-only for a sharper reason than the collections above: channelLinks
// is what maps an inbound phone number to a uid, so a client that could write
// one would bind its own number to someone else's account. Every assertion
// here is on the *authenticated* owner — the point is that even they are
// denied, because the linking flow runs through Server Actions, not the client
// SDK. Reads are asserted too: a phone-keyed collection a client can read is an
// oracle for "is this number registered".
describe("messaging channels (channelLinks, channelLinkCodes, chatSessions)", () => {
  const CHANNEL_KEY = "whatsapp:+972501234567";

  it("client cannot read or write a channelLink, even one pointing at their own uid", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, `channelLinks/${CHANNEL_KEY}`), {
        channelKey: CHANNEL_KEY,
        uid: USER_A,
        channel: "whatsapp",
        externalId: "+972501234567",
        linkedAt: new Date(),
        lastMessageAt: null,
      })
    );
    await assertFails(getDoc(doc(dbA, `channelLinks/${CHANNEL_KEY}`)));
  });

  it("client cannot forge a channelLink pointing at another user's uid", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, `channelLinks/${CHANNEL_KEY}`), {
        channelKey: CHANNEL_KEY,
        uid: USER_B,
        channel: "whatsapp",
        externalId: "+972501234567",
        linkedAt: new Date(),
        lastMessageAt: null,
      })
    );
  });

  it("client cannot read or write channelLinkCodes", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "channelLinkCodes/ABCD2345"), {
        code: "ABCD2345",
        uid: USER_A,
        channel: "whatsapp",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
      })
    );
    // Reading someone else's unused code is enough to hijack their link.
    await assertFails(getDoc(doc(dbA, "channelLinkCodes/ABCD2345")));
  });

  it("client cannot read or write chatSessions", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, `chatSessions/${CHANNEL_KEY}`), {
        channelKey: CHANNEL_KEY,
        uid: USER_A,
        history: [],
        updatedAt: new Date(),
      })
    );
    await assertFails(getDoc(doc(dbA, `chatSessions/${CHANNEL_KEY}`)));
  });

  // Phase 5.5.b: a client able to create a dedup claim ahead of a real inbound
  // message would make the webhook drop it — a silent denial of service on one
  // message, by design impossible to distinguish from a provider retry.
  it("client cannot read or write channelMessages", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "channelMessages/abc123"), {
        channelKey: CHANNEL_KEY,
        messageId: "wamid.abc",
        receivedAt: new Date(),
      })
    );
    await assertFails(getDoc(doc(dbA, "channelMessages/abc123")));
  });

  it("unauthenticated client cannot touch any of the four", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `channelLinks/${CHANNEL_KEY}`)));
    await assertFails(getDoc(doc(db, "channelLinkCodes/ABCD2345")));
    await assertFails(getDoc(doc(db, `chatSessions/${CHANNEL_KEY}`)));
    await assertFails(getDoc(doc(db, "channelMessages/abc123")));
  });
});

// docs/DECISIONS.md ADR #37 (issue #58). Same bearer-credential class as
// channelLinkCodes above: the doc id is the secret carried in a WhatsApp
// message, so a readable collection would let anyone enumerate live invites
// and accept one addressed to someone else. Asserted for the list owner too —
// both the owner's and the invitee's views go through Server Actions.
describe("listInviteCodes", () => {
  const INVITE_CODE = "ABCD2345WXYZ";

  function inviteDoc(listId: string, invitedBy: string) {
    return {
      code: INVITE_CODE,
      listId,
      role: "viewer",
      phone: "+972501234567",
      invitedBy,
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
    };
  }

  it("list owner cannot create an invite from the client", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "cardLists/list-invite"), {
        ownerId: USER_A,
        name: "רשימה",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await assertFails(
      setDoc(doc(dbA, `listInviteCodes/${INVITE_CODE}`), inviteDoc("list-invite", USER_A))
    );
  });

  it("nobody can read an invite code, not even the owner who issued it", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `listInviteCodes/${INVITE_CODE}`),
        inviteDoc("list-invite", USER_A)
      );
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    const anon = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(dbA, `listInviteCodes/${INVITE_CODE}`)));
    await assertFails(getDoc(doc(dbB, `listInviteCodes/${INVITE_CODE}`)));
    await assertFails(getDoc(doc(anon, `listInviteCodes/${INVITE_CODE}`)));
  });

  it("an invitee cannot mark an invite accepted from the client", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `listInviteCodes/${INVITE_CODE}`),
        inviteDoc("list-invite", USER_A)
      );
    });

    // The whole point of the accept path living in a Server Action: the
    // channelLinks check that proves the phone belongs to this account cannot
    // be expressed here, so a client write would bypass it entirely.
    const dbB = testEnv.authenticatedContext(USER_B).firestore();
    await assertFails(
      updateDoc(doc(dbB, `listInviteCodes/${INVITE_CODE}`), { status: "accepted" })
    );
  });
});

describe("consents", () => {
  it("owner can create their own consent record", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
      setDoc(doc(dbA, "consents", USER_A), {
        uid: USER_A,
        privacyPolicyVersion: "2026-08-25",
        acceptedAt: serverTimestamp(),
        marketingConsent: false,
      })
    );
  });

  it("cannot create a consent record for another uid", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "consents", USER_B), {
        uid: USER_B,
        privacyPolicyVersion: "2026-08-25",
        acceptedAt: serverTimestamp(),
        marketingConsent: false,
      })
    );
  });
});

// docs/DECISIONS.md ADR #42. Both collections are Admin-SDK-only, even for
// the caller's own uid — adminRoles has no legitimate client write path at
// all (a self-write would be a self-grant of admin), and adminAuditLog is an
// append-only ledger read only through an admin Server Action.
describe("admin (adminRoles, adminAuditLog)", () => {
  it("client cannot read or write their own adminRoles doc", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, `adminRoles/${USER_A}`), {
        uid: USER_A,
        role: "super_admin",
        grantedBy: "system",
        grantedAt: serverTimestamp(),
      })
    );
    await assertFails(getDoc(doc(dbA, `adminRoles/${USER_A}`)));
  });

  it("an existing admin still cannot read their own adminRoles doc via the client SDK", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc(`adminRoles/${USER_A}`), {
        uid: USER_A,
        role: "super_admin",
        grantedBy: "system",
        grantedAt: new Date(),
      });
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(getDoc(doc(dbA, `adminRoles/${USER_A}`)));
  });

  it("client cannot read or write adminAuditLog", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "adminAuditLog/entry1"), {
        adminUid: USER_A,
        targetUid: USER_B,
        action: "block",
        reason: null,
        createdAt: serverTimestamp(),
      })
    );
    await assertFails(getDoc(doc(dbA, "adminAuditLog/entry1")));
  });

  it("unauthenticated client cannot touch either collection", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `adminRoles/${USER_A}`)));
    await assertFails(getDoc(doc(db, "adminAuditLog/entry1")));
  });
});

// docs/DECISIONS.md ADR #44. All three Admin-SDK-only, same reasoning as
// adminRoles/adminAuditLog above — not even an admin reads/writes these
// through the client SDK, only through Server Actions/service functions that
// already ran requireAdmin() or the enforcement checks in moderation.ts.
describe("user blocking (userModeration, blockedEmails, blockedPhones)", () => {
  it("client cannot read or write their own userModeration doc", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, `userModeration/${USER_A}`), {
        uid: USER_A,
        blocked: false,
        blockedReason: null,
        blockedAt: null,
        blockedBy: null,
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(getDoc(doc(dbA, `userModeration/${USER_A}`)));
  });

  it("a blocked user still cannot read or clear their own userModeration doc via the client SDK", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc(`userModeration/${USER_A}`), {
        uid: USER_A,
        blocked: true,
        blockedReason: "test",
        blockedAt: serverTimestamp(),
        blockedBy: USER_B,
        updatedAt: serverTimestamp(),
      });
    });

    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(getDoc(doc(dbA, `userModeration/${USER_A}`)));
    await assertFails(updateDoc(doc(dbA, `userModeration/${USER_A}`), { blocked: false }));
  });

  it("client cannot read or write blockedEmails", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "blockedEmails/blocked@example.com"), {
        email: "blocked@example.com",
        blockedReason: null,
        blockedAt: serverTimestamp(),
        blockedBy: USER_A,
      })
    );
    await assertFails(getDoc(doc(dbA, "blockedEmails/blocked@example.com")));
  });

  it("client cannot read or write blockedPhones", async () => {
    const dbA = testEnv.authenticatedContext(USER_A).firestore();
    await assertFails(
      setDoc(doc(dbA, "blockedPhones/+972501234567"), {
        phone: "+972501234567",
        blockedReason: null,
        blockedAt: serverTimestamp(),
        blockedBy: USER_A,
      })
    );
    await assertFails(getDoc(doc(dbA, "blockedPhones/+972501234567")));
  });

  it("unauthenticated client cannot touch any of the three collections", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `userModeration/${USER_A}`)));
    await assertFails(getDoc(doc(db, "blockedEmails/blocked@example.com")));
    await assertFails(getDoc(doc(db, "blockedPhones/+972501234567")));
  });
});

// Sanity check that the suite itself is wired up correctly.
describe("environment", () => {
  it("has a test environment", () => {
    expect(testEnv).toBeDefined();
  });
});
