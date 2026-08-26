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

// Sanity check that the suite itself is wired up correctly.
describe("environment", () => {
  it("has a test environment", () => {
    expect(testEnv).toBeDefined();
  });
});
