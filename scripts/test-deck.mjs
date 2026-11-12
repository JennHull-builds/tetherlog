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
