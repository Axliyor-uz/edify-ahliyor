/**
 * English-grammar rules tests (`enggrammar_*`, EdifyStudent Android — its
 * docs/GRAMMAR.md). Run with: npm run test:rules
 * (RULES_FILE=path overrides the rules source, e.g. to test a deploy candidate.)
 *
 * Content (meta / syllabus / topics / questions) is published by the Admin SDK
 * only: any signed-in user reads it, NO client writes it. Progress is one
 * private doc per student (id == uid) in a fixed, size-capped shape.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp } from "firebase/firestore";

let testEnv;

const progress = (extra = {}) => ({
  schema: 1,
  xp: 120,
  points: { "be.positive": { passed: true, crowns: 1, best: 80, step: 0, due: 1_700_000_000_000 } },
  items: { be1_001: { seen: 2, wrong: 1, streak: 1 } },
  tags: { "BE:FORM": 1 },
  ...extra,
});

const SEED = {
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 0 },
  "users/student2": { uid: "student2", role: "student", username: "student2", totalXP: 0 },
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "enggrammar_meta/current": { schema: 1, syllabusVersion: "s1", topics: { "a1.be": "v1" } },
  "enggrammar_syllabus/main": { schema: 1, version: "s1", json: "{}" },
  "enggrammar_topics/a1.be": { schema: 1, version: "v1", topicJson: "{}" },
  "enggrammar_questions/a1.be": { schema: 1, version: "v1", questionsJson: "[]" },
  "enggrammar_progress/student1": progress(),
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-enggrammar",
    firestore: {
      rules: readFileSync(process.env.RULES_FILE || "firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries(SEED)) await setDoc(doc(db, path), data);
  });
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();
const CONTENT = ["enggrammar_meta/current", "enggrammar_syllabus/main", "enggrammar_topics/a1.be", "enggrammar_questions/a1.be"];

// ─────────────────────────────────────────────────────────────────────────────
describe("ENGGRAMMAR content — read by any signed-in user, written by no client", () => {
  for (const path of CONTENT) {
    it(`a student reads ${path}`, async () => {
      await assertSucceeds(getDoc(doc(as("student1"), path)));
    });
    it(`a signed-out visitor cannot read ${path}`, async () => {
      await assertFails(getDoc(doc(anon(), path)));
    });
    it(`a student cannot overwrite ${path}`, async () => {
      await assertFails(setDoc(doc(as("student1"), path), { schema: 1, version: "hacked" }));
    });
    it(`a teacher cannot overwrite ${path}`, async () => {
      await assertFails(setDoc(doc(as("teacher1"), path), { schema: 1, version: "hacked" }));
    });
    it(`nobody can delete ${path}`, async () => {
      await assertFails(deleteDoc(doc(as("teacher1"), path)));
    });
  }
  it("a student cannot create a new content doc", async () => {
    await assertFails(setDoc(doc(as("student1"), "enggrammar_topics/a1.fake"), { schema: 1 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ENGGRAMMAR progress — private to its owner", () => {
  it("the owner reads their progress", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "enggrammar_progress/student1")));
  });
  it("another student cannot read it", async () => {
    await assertFails(getDoc(doc(as("student2"), "enggrammar_progress/student1")));
  });
  it("a teacher cannot read it", async () => {
    await assertFails(getDoc(doc(as("teacher1"), "enggrammar_progress/student1")));
  });
  it("a signed-out visitor cannot read it", async () => {
    await assertFails(getDoc(doc(anon(), "enggrammar_progress/student1")));
  });
  it("a new student creates their own progress", async () => {
    await assertSucceeds(setDoc(doc(as("student2"), "enggrammar_progress/student2"), progress({ updatedAt: serverTimestamp() })));
  });
  it("the owner overwrites their progress", async () => {
    await assertSucceeds(setDoc(doc(as("student1"), "enggrammar_progress/student1"), progress({ xp: 300 })));
  });
  it("the owner updates a field", async () => {
    await assertSucceeds(updateDoc(doc(as("student1"), "enggrammar_progress/student1"), { xp: 400 }));
  });
  it("empty maps are a valid fresh start", async () => {
    await assertSucceeds(setDoc(doc(as("student2"), "enggrammar_progress/student2"), progress({ xp: 0, points: {}, items: {}, tags: {} })));
  });
  it("game bests may ride along", async () => {
    await assertSucceeds(setDoc(doc(as("student2"), "enggrammar_progress/student2"), progress({ games: { speedBest: 12 } })));
  });
  it("nobody writes someone else's progress", async () => {
    await assertFails(setDoc(doc(as("student2"), "enggrammar_progress/student1"), progress()));
  });
  it("the owner cannot delete their progress", async () => {
    await assertFails(deleteDoc(doc(as("student1"), "enggrammar_progress/student1")));
  });
});

describe("ENGGRAMMAR progress — shape is enforced", () => {
  const bad = {
    "an unknown field": progress({ totalXP: 9999 }),
    "a wrong schema": progress({ schema: 2 }),
    "negative xp": progress({ xp: -5 }),
    "huge xp": progress({ xp: 99_000_000 }),
    "xp as a string": progress({ xp: "120" }),
    "points as a list": progress({ points: ["be.positive"] }),
    "items as a string": progress({ items: "x" }),
    "tags as a number": progress({ tags: 3 }),
    "games as a list": progress({ games: [1, 2] }),
    "a client-chosen updatedAt": progress({ updatedAt: new Date(0) }),
  };
  for (const [name, data] of Object.entries(bad)) {
    it(`rejects ${name}`, async () => {
      await assertFails(setDoc(doc(as("student2"), "enggrammar_progress/student2"), data));
    });
  }
  it("rejects a doc missing points", async () => {
    const { points, ...rest } = progress();
    await assertFails(setDoc(doc(as("student2"), "enggrammar_progress/student2"), rest));
  });
});
