// Tests for src/lib/deck.ts. Node 24 runs the TypeScript directly.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DeckError,
  checkDeck,
  formatDeckAnswers,
  makeDeckLink,
  readDeckAnswers,
  readDeckLink,
} from "../src/lib/deck.ts";

const BASE = "http://localhost:4188";
const example = () => JSON.parse(readFileSync(new URL("./fixtures/deck-example.json", import.meta.url), "utf8"));

function refused(mutate, pattern, label) {
  test(`refuses: ${label}`, () => {
    const deck = example();
    mutate(deck);
    assert.throws(() => checkDeck(deck), (error) => {
      assert.ok(error instanceof DeckError, "expected a DeckError");
      assert.match(error.message, pattern);
      return true;
    });
  });
}

test("a deck survives make-link then read-link unchanged", () => {
  const deck = example();
  assert.deepEqual(readDeckLink(makeDeckLink(deck, BASE)), deck);
});

test("accented letters and an emoji survive the link", () => {
  const deck = example();
  deck.title = "Café décisions 🎯";
  deck.cards[0].question = "Garder le nom « naïve » 🚀 ?";
  const back = readDeckLink(makeDeckLink(deck, BASE));
  assert.equal(back.title, "Café décisions 🎯");
  assert.equal(back.cards[0].question, "Garder le nom « naïve » 🚀 ?");
});

test("a link can be read from the whole address, the hash, or the bare payload", () => {
  const deck = example();
  const link = makeDeckLink(deck, BASE + "/");
  assert.ok(link.startsWith(BASE + "/#deck=1."));
  const hash = link.slice(link.indexOf("#"));
  assert.deepEqual(readDeckLink(hash), deck);
  assert.deepEqual(readDeckLink(hash.slice(hash.indexOf("=") + 1)), deck);
});

test("refuses: wrong format number in the link", () => {
  const link = makeDeckLink(example(), BASE);
  assert.throws(() => readDeckLink(link.replace("#deck=1.", "#deck=2.")), /format 2/);
});

test("refuses: wrong format number inside the deck", () => {
  const deck = example();
  deck.v = 2;
  assert.throws(() => checkDeck(deck), /format number/);
});

test("refuses: broken base64", () => {
  assert.throws(() => readDeckLink("#deck=1.@@@not base64@@@"), /not encoded/);
  assert.throws(() => readDeckLink("#deck=1."), /no cards/);
  assert.throws(() => readDeckLink("#deck=nodot"), /format number/);
});

test("refuses: bytes that are not UTF-8", () => {
  // 0xFF is never valid UTF-8.
  assert.throws(() => readDeckLink("#deck=1.__8"), /valid text/);
});

test("refuses: broken JSON", () => {
  const payload = Buffer.from("{not json").toString("base64url");
  assert.throws(() => readDeckLink(`#deck=1.${payload}`), /JSON is broken/);
});

test("refuses: a payload over 100,000 characters", () => {
  assert.throws(() => readDeckLink("#deck=1." + "A".repeat(100_001)), /too large/);
});

refused((d) => delete d.title, /missing a field/, "a missing field");
refused((d) => delete d.cards[1].reason, /missing a field/, "a missing card field");
refused((d) => (d.cards[0].pick = "Z"), /pick "Z" is not one of the keys/, "a pick that is not a key");
refused((d) => (d.cards[0].choices[1].key = "A"), /key "A" is used twice/, "two choices with one key");
refused((d) => (d.cards[1].id = d.cards[0].id), /id "rename-export" is used twice/, "two cards with one id");
refused((d) => (d.cards = Array.from({ length: 13 }, (_, i) => ({ ...d.cards[0], id: `card-${i}` }))), /1 to 12 cards/, "13 cards");
refused((d) => (d.cards = []), /1 to 12 cards/, "no cards");
refused((d) => (d.cards[1].choices = [...d.cards[1].choices, { key: "D", label: "d" }, { key: "E", label: "e" }]), /2 to 4 choices/, "5 choices");
refused((d) => (d.cards[0].choices = [d.cards[0].choices[0]]), /2 to 4 choices/, "1 choice");
refused((d) => (d.cards[1].link.href = "example.com/no-scheme"), /https:\/\//, "a link with no scheme");
refused((d) => (d.cards[1].link.href = "http://example.com/a"), /https:\/\//, "an http link");
refused((d) => (d.cards[1].link.href = "javascript:alert(1)"), /https:\/\//, "a javascript link");
refused((d) => (d.cards[0].choices[1].key = "not NOW"), /Not now/, 'a key of "not now"');
refused((d) => (d.cards[0].id = "Upper_Case"), /lower case letters/, "an id with the wrong characters");
refused((d) => (d.createdAt = "yesterday-ish"), /ISO date/, "a date that is not a date");

// Each string, one character over its limit.
const over = [
  ["title", 60, (d, v) => (d.title = v), /title/],
  ["from", 40, (d, v) => (d.from = v), /from/],
  ["replyTo", 120, (d, v) => (d.replyTo = v), /replyTo/],
  ["deck id", 60, (d, v) => (d.id = v), /id/],
  ["card id", 40, (d, v) => (d.cards[0].id = v), /id/],
  ["question", 80, (d, v) => (d.cards[0].question = v), /question/],
  ["context", 240, (d, v) => (d.cards[0].context = v), /context/],
  ["reason", 200, (d, v) => (d.cards[0].reason = v), /reason/],
  ["key", 12, (d, v) => { d.cards[0].choices[0].key = v; d.cards[0].pick = v; }, /key/],
  ["label", 60, (d, v) => (d.cards[0].choices[0].label = v), /label/],
  ["detail", 160, (d, v) => (d.cards[0].choices[0].detail = v), /detail/],
  ["link text", 40, (d, v) => (d.cards[1].link.text = v), /link text/],
];
for (const [name, limit, set, pattern] of over) {
  const fill = name.endsWith("id") ? "a" : "x";
  refused((d) => set(d, fill.repeat(limit + 1)), pattern, `${name} one character over (${limit})`);
  test(`accepts: ${name} exactly at its limit (${limit})`, () => {
    const deck = example();
    set(deck, fill.repeat(limit));
    checkDeck(deck);
  });
}

test("refuses: a link href over 300 characters", () => {
  const deck = example();
  deck.cards[1].link.href = "https://example.com/" + "a".repeat(281);
  assert.throws(() => checkDeck(deck), /link href/);
});

test("each message names the card it is about", () => {
  const deck = example();
  deck.cards[2].reason = "";
  assert.throws(() => checkDeck(deck), /Card 3 \(old-flag\): reason/);
});

test("formatDeckAnswers: one pick taken, one changed, one left open", () => {
  const deck = checkDeck(example());
  const stored = {
    id: deck.id,
    deck,
    receivedAt: 1,
    answers: {
      "rename-export": { choice: "A", at: 1 },
      "empty-state": { choice: "B", at: 2 },
      "old-flag": { skipped: true, at: 3 },
    },
  };
  const at = new Date(2026, 10, 13, 9, 14).getTime();
  assert.equal(
    formatDeckAnswers(stored, at),
    [
      "TetherLog answers",
      "Deck: example-deck (Example questions)",
      "From: An agent",
      "Answered: 2026-11-13 09:14",
      "",
      "rename-export: A = Keep the name [the agent's pick]",
      "empty-state: B = Show a sample [changed from A]",
      "old-flag: left open",
      "",
      "2 of 3 answered. Left open means no decision: the agent's pick is not approved.",
    ].join("\n"),
  );
});

test("formatDeckAnswers: nothing left open drops the second sentence", () => {
  const deck = checkDeck(example());
  const stored = {
    id: deck.id,
    deck,
    receivedAt: 1,
    answers: Object.fromEntries(deck.cards.map((c) => [c.id, { choice: c.pick, at: 1 }])),
  };
  const lines = formatDeckAnswers(stored, 0).split("\n");
  assert.equal(lines.at(-1), "3 of 3 answered.");
});

// ── reading answers back (slice 2) ──────────────────────────────────────────

function storedWith(answers) {
  const deck = checkDeck(example());
  return { id: deck.id, deck, receivedAt: 1, answers };
}
const mixed = () =>
  storedWith({
    "rename-export": { choice: "A", at: 1 },
    "empty-state": { choice: "B", at: 2 },
    "old-flag": { skipped: true, at: 3 },
  });

test("answers survive format then read", () => {
  const stored = mixed();
  const read = readDeckAnswers(stored.deck, formatDeckAnswers(stored, 0));
  assert.equal(read.deck, "example-deck");
  assert.equal(read.answered, 2);
  assert.equal(read.total, 3);
  assert.deepEqual(read.answers, [
    { id: "rename-export", status: "answered", choice: "A", label: "Keep the name", pick: "A", changedFromPick: false },
    { id: "empty-state", status: "answered", choice: "B", label: "Show a sample", pick: "A", changedFromPick: true },
    { id: "old-flag", status: "left open", pick: "Yes", changedFromPick: false },
  ]);
});

test("a fully answered deck reads back too, and Windows line endings are fine", () => {
  const stored = storedWith(Object.fromEntries(checkDeck(example()).cards.map((c) => [c.id, { choice: c.pick, at: 1 }])));
  const text = formatDeckAnswers(stored, 0).replace(/\n/g, "\r\n");
  assert.equal(readDeckAnswers(stored.deck, text).answered, 3);
});

function refusedAnswers(change, pattern, label) {
  test(`refuses pasted answers: ${label}`, () => {
    const stored = mixed();
    const text = change(formatDeckAnswers(stored, 0));
    assert.throws(() => readDeckAnswers(stored.deck, text), (error) => {
      assert.ok(error instanceof DeckError);
      assert.match(error.message, pattern);
      return true;
    });
  });
}

refusedAnswers((t) => t.replace("TetherLog answers", "Something else"), /Line 1/, "text that does not start the right way");
refusedAnswers((t) => t.replace("Deck: example-deck", "Deck: other-deck"), /other-deck.*example-deck/, "a wrong deck id");
refusedAnswers((t) => t.replace("empty-state:", "invented-card:"), /"invented-card" is not in the deck/, "an unknown card id");
refusedAnswers((t) => t.replace("B = Show a sample [changed from A]", "Z = Show a sample [changed from A]"), /no choice on the card "empty-state"/, "an unknown key");
refusedAnswers((t) => t.replace("Keep the name", "Keep the old name"), /expected .*Keep the name/, "a label that is not the deck's");
refusedAnswers((t) => t.replace("[the agent's pick]", "[changed from B]"), /expected/, "a note that does not match");
refusedAnswers((t) => t.split("\n").slice(0, -1).join("\n"), /cut off/, "a truncated paste (the closing line is missing)");
refusedAnswers((t) => t.replace("old-flag: left open\n", ""), /missing 1 card: old-flag/, "a card missing");
refusedAnswers((t) => t.replace("old-flag: left open", "old-flag: left open\nold-flag: left open"), /appears twice/, "a card twice");
refusedAnswers((t) => t.replace("2 of 3 answered", "3 of 3 answered"), /says 3 of 3, but the cards say 2 of 3/, "a closing count that disagrees");
refusedAnswers((t) => t + "\nextra", /nothing may follow/, "text after the closing line");
refusedAnswers((t) => t.replace("old-flag: left open", "old-flag maybe"), /cannot read/, "a line it cannot read");
refusedAnswers((t) => t.replace(/Deck: .*\n/, ""), /no Deck line/, "no Deck line");

// ── notes (slice 3) ─────────────────────────────────────────────────────────

test("a note follows the answer on the same line and comes back", () => {
  const stored = storedWith({
    "rename-export": { choice: "A", at: 1 },
    "empty-state": { choice: "B", note: "but shorter", at: 2 },
    "old-flag": { skipped: true, at: 3 },
  });
  const text = formatDeckAnswers(stored, 0);
  assert.ok(text.includes("empty-state: B = Show a sample [changed from A] | note: but shorter\n"));
  const read = readDeckAnswers(stored.deck, text);
  assert.equal(read.answers[1].note, "but shorter");
  assert.equal(read.answers[0].note, undefined);
});

test("a note with brackets, pipes and a second note mark is kept whole", () => {
  const note = "keep [both] | and | note: this";
  const stored = storedWith({ "rename-export": { choice: "A", note, at: 1 } });
  assert.equal(readDeckAnswers(stored.deck, formatDeckAnswers(stored, 0)).answers[0].note, note);
});

test("line breaks in a note become spaces, so the answer stays on one line", () => {
  const stored = storedWith({ "rename-export": { choice: "A", note: "one\ntwo", at: 1 } });
  assert.ok(formatDeckAnswers(stored, 0).includes("| note: one two\n"));
});

test("an empty or blank note adds nothing", () => {
  const stored = storedWith({ "rename-export": { choice: "A", note: "   ", at: 1 } });
  assert.ok(!formatDeckAnswers(stored, 0).includes("note:"));
});

test("a note of exactly 200 characters reads back, 201 is refused", () => {
  const at200 = storedWith({ "rename-export": { choice: "A", note: "n".repeat(200), at: 1 } });
  assert.equal(readDeckAnswers(at200.deck, formatDeckAnswers(at200, 0)).answers[0].note.length, 200);
  const at201 = storedWith({ "rename-export": { choice: "A", note: "n".repeat(201), at: 1 } });
  assert.throws(() => readDeckAnswers(at201.deck, formatDeckAnswers(at201, 0)), /1 to 200 characters/);
});

test("an answer changed from the wrap-up changes the text", () => {
  const stored = mixed();
  const before = formatDeckAnswers(stored, 0);
  stored.answers["old-flag"] = { choice: "Later", at: 9 };
  const after = formatDeckAnswers(stored, 0);
  assert.notEqual(before, after);
  assert.ok(after.includes("old-flag: Later = Remove it next release [changed from Yes]"));
  assert.ok(after.includes("3 of 3 answered.\n") === false && after.endsWith("3 of 3 answered."));
});

// ── the sample deck (slice 3) ───────────────────────────────────────────────

test("the sample deck passes every check a deck from a link passes", () => {
  const sample = JSON.parse(readFileSync(new URL("../public/sample-deck.json", import.meta.url), "utf8"));
  const deck = checkDeck(sample);
  assert.equal(deck.id, "tetherlog-sample-deck");
  assert.ok(deck.cards.length >= 5 && deck.cards.length <= 6);
  assert.deepEqual(readDeckLink(makeDeckLink(sample, BASE)), deck);
});

test("the sample deck holds no em dash, no address and nothing personal", () => {
  const raw = readFileSync(new URL("../public/sample-deck.json", import.meta.url), "utf8");
  assert.ok(!raw.includes("\u2014"), "em dash");
  assert.ok(!/https?:|@|\/Users\//.test(raw), "address or path");
});
