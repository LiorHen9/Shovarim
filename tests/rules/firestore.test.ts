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
    const db = testEnv.authenticatedContext(USER_A).firestore();
    await assertSucceeds(
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
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
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
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
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
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
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
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
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

describe("usageLog (immutable audit trail)", () => {
  async function seedCard() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(context.firestore().doc("cards/card1"), {
        ownerId: USER_A,
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
