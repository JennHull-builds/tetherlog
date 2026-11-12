#!/usr/bin/env node
// Turn pasted answers into JSON, checked against the deck they came from.
//
//   node scripts/answers.mjs <deck.json> <answers.txt>
//   pbpaste | node scripts/answers.mjs <deck.json>
//
// JSON goes to stdout. A paste that does not match the deck, or was cut short,
// is refused: the problem goes to stderr naming the line, and the exit code is 1.
// A card that came back "left open" means no decision. Its pick is not approved.
import { readFileSync } from "node:fs";
import { DeckError, checkDeck, readDeckAnswers } from "../src/lib/deck.ts";

const [deckFile, answersFile] = process.argv.slice(2);

function fail(message) {
  process.stderr.write(`answers: ${message}\n`);
  process.exit(1);
}

if (!deckFile) fail("Usage: node scripts/answers.mjs <deck.json> [answers.txt]  (or the text on stdin)");

try {
  const deck = checkDeck(JSON.parse(readFileSync(deckFile, "utf8")));
  const text = readFileSync(answersFile ?? 0, "utf8");
  process.stdout.write(`${JSON.stringify(readDeckAnswers(deck, text), null, 2)}\n`);
} catch (error) {
  if (error instanceof DeckError) fail(error.message);
  if (error instanceof SyntaxError) fail(`The deck file is not JSON: ${error.message}`);
  if (error && error.code === "ENOENT") fail(`No such file: ${error.path}`);
  throw error;
}
