#!/usr/bin/env node
// Make a TetherLog link from a deck file.
//
//   node scripts/park.mjs <deck.json> --base <address> [--out <folder>] [--open]
//
// --out also writes <deck id>.html in that folder: a page that forwards to the
// link at once, with a plain "Open the deck" link in case forwarding is blocked.
// It exists so a long link never has to be pasted into a note or a chat.
//
// The link goes to stdout and nothing else does. Problems go to stderr, naming
// the card and the field. The deck is checked with the same code the app uses to
// read it (src/lib/deck.ts), so a link made here is a link the app accepts.
//
// There is no default address on purpose. A link pointed at a build that cannot
// read decks opens Capture and says nothing, which is the worst kind of failure
// here. Pass --base, or set TETHERLOG_BASE.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DeckError, checkDeck, makeDeckLink } from "../src/lib/deck.ts";

const args = process.argv.slice(2);
let file;
let base = process.env.TETHERLOG_BASE;
let open = false;
let out;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--base") base = args[(i += 1)];
  else if (args[i] === "--open") open = true;
  else if (args[i] === "--out") out = args[(i += 1)];
  else if (!file) file = args[i];
  else fail(`Unexpected argument: ${args[i]}`);
}

function fail(message) {
  process.stderr.write(`park: ${message}\n`);
  process.exit(1);
}

if (!file) fail("Usage: node scripts/park.mjs <deck.json> --base <address> [--out <folder>] [--open]");
if (!base) {
  fail("No address. Pass --base <address> or set TETHERLOG_BASE, so the link opens a build that can read decks.");
}
if (!/^https?:\/\//i.test(base)) fail(`The address must start with http:// or https:// (got "${base}").`);

let raw;
try {
  raw = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  fail(`Could not read ${file} as JSON: ${error.message}`);
}

let link;
let deck;
try {
  deck = checkDeck(raw);
  link = makeDeckLink(deck, base);
} catch (error) {
  if (error instanceof DeckError) fail(error.message);
  throw error;
}

const escape = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

if (out) {
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, `${deck.id}.html`),
    `<!doctype html>
<meta charset="utf-8">
<title>TetherLog: ${escape(deck.title)}</title>
<meta http-equiv="refresh" content="0; url=${escape(link)}">
<p><a href="${escape(link)}">Open the deck</a></p>
`,
  );
}

process.stdout.write(`${link}\n`);

if (open) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawnSync(opener, [link], { stdio: "ignore" });
}
