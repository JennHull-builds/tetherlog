import { deckSchema, type Deck, type StoredDeck } from "../types.ts";

/**
 * Decks: questions an agent parks for the person to answer in Review (D-047).
 *
 * Pure functions. No DOM, no Dexie, so Node can run them (scripts/park.mjs and
 * scripts/test-deck.mjs import this file directly).
 *
 * A DECK IS UNTRUSTED INPUT. Anyone can make a link. Every limit is enforced
 * when a link is read, and a deck that fails any check is refused whole: the
 * person never sees part of one. Fields are only ever rendered as text.
 *
 * THE LINK is `<base>/#deck=1.<payload>`. The part after `#` is never sent to a
 * server. `1` is the format number, reserved so compression can come later.
 * The payload is the deck as JSON, UTF-8, base64url, no padding.
 */

export const DECK_FORMAT = 1;
/** Longest payload accepted, in characters. */
export const MAX_PAYLOAD = 100_000;
/** The word on the button that leaves a card open. A choice may not use it. */
export const NOT_NOW = "Not now";

/** Thrown for any deck or link that cannot be used. The message names the problem. */
export class DeckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckError";
  }
}

const ID_PATTERN = /^[a-z0-9-]+$/;

/** Characters, counted by code point so an emoji is one. */
function length(value: string): number {
  return Array.from(value).length;
}

function text(value: unknown, where: string, min: number, max: number): string {
  if (typeof value !== "string") throw new DeckError(`${where} must be text.`);
  const trimmed = value.trim();
  const count = length(trimmed);
  if (count < min || count > max) {
    const range = min === 0 ? `at most ${max}` : `${min} to ${max}`;
    throw new DeckError(`${where} must be ${range} characters (it is ${count}).`);
  }
  return trimmed;
}

function id(value: unknown, where: string, max: number): string {
  const trimmed = text(value, where, 1, max);
  if (!ID_PATTERN.test(trimmed)) {
    throw new DeckError(`${where} may only use lower case letters, digits and hyphens.`);
  }
  return trimmed;
}

/**
 * Check a deck of unknown shape against the shape and every limit, and return
 * a clean copy with each string trimmed. Throws DeckError naming the card and
 * the field. Exported so park.mjs reports with the same rules the app uses.
 */
export function checkDeck(raw: unknown): Deck {
  const shape = deckSchema.safeParse(raw);
  if (!shape.success) {
    const first = shape.error.issues[0];
    const path = first ? first.path.join(".") : "";
    throw new DeckError(
      first && first.code === "invalid_value" && path === "v"
        ? `The format number must be ${DECK_FORMAT}.`
        : `The deck is missing a field or has one of the wrong kind${path ? ` (${path})` : ""}.`,
    );
  }
  const input = shape.data;

  const created = text(input.createdAt, "createdAt", 1, 40);
  if (Number.isNaN(Date.parse(created))) {
    throw new DeckError("createdAt must be an ISO date and time.");
  }

  if (input.cards.length < 1 || input.cards.length > 12) {
    throw new DeckError(`A deck holds 1 to 12 cards (it has ${input.cards.length}).`);
  }

  const seenCards = new Set<string>();
  const cards = input.cards.map((card, index) => {
    const name = `Card ${index + 1}`;
    const cardId = id(card.id, `${name}: id`, 40);
    if (seenCards.has(cardId)) throw new DeckError(`${name}: the id "${cardId}" is used twice.`);
    seenCards.add(cardId);
    const where = `Card ${index + 1} (${cardId})`;

    if (card.choices.length < 2 || card.choices.length > 4) {
      throw new DeckError(`${where}: a card holds 2 to 4 choices (it has ${card.choices.length}).`);
    }
    const seenKeys = new Set<string>();
    const choices = card.choices.map((choice, c) => {
      const spot = `${where}, choice ${c + 1}`;
      const key = text(choice.key, `${spot}: key`, 1, 12);
      if (key.toLowerCase() === NOT_NOW.toLowerCase()) {
        throw new DeckError(`${spot}: the key may not be "${NOT_NOW}", that button is always there.`);
      }
      if (seenKeys.has(key)) throw new DeckError(`${where}: the key "${key}" is used twice.`);
      seenKeys.add(key);
      const clean: Deck["cards"][number]["choices"][number] = {
        key,
        label: text(choice.label, `${spot}: label`, 1, 60),
      };
      if (choice.detail !== undefined) clean.detail = text(choice.detail, `${spot}: detail`, 0, 160);
      return clean;
    });

    const pick = text(card.pick, `${where}: pick`, 1, 12);
    if (!seenKeys.has(pick)) throw new DeckError(`${where}: the pick "${pick}" is not one of the keys.`);

    const clean: Deck["cards"][number] = {
      id: cardId,
      question: text(card.question, `${where}: question`, 1, 80),
      pick,
      reason: text(card.reason, `${where}: reason`, 1, 200),
      choices,
    };
    if (card.context !== undefined) clean.context = text(card.context, `${where}: context`, 0, 240);
    if (card.link !== undefined) {
      const href = text(card.link.href, `${where}: link href`, 1, 300);
      if (!/^https:\/\/[^\s]+$/i.test(href)) {
        throw new DeckError(`${where}: a link must start with https:// and hold no spaces.`);
      }
      try {
        if (new URL(href).protocol !== "https:") throw new Error("not https");
      } catch {
        throw new DeckError(`${where}: the link is not a web address.`);
      }
      clean.link = { href, text: text(card.link.text, `${where}: link text`, 1, 40) };
    }
    return clean;
  });

  const deck: Deck = {
    v: 1,
    id: id(input.id, "id", 60),
    title: text(input.title, "title", 1, 60),
    from: text(input.from, "from", 1, 40),
    createdAt: created,
    cards,
  };
  if (input.replyTo !== undefined) deck.replyTo = text(input.replyTo, "replyTo", 0, 120);
  return deck;
}

// ── the link ────────────────────────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(payload: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) {
    throw new DeckError("The link is not encoded the way TetherLog reads.");
  }
  let binary: string;
  try {
    binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    throw new DeckError("The link is not encoded the way TetherLog reads.");
  }
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Make the link for a deck. The deck is checked first, so a bad deck never becomes a link. */
export function makeDeckLink(raw: unknown, base: string): string {
  const deck = checkDeck(raw);
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(deck)));
  if (payload.length > MAX_PAYLOAD) {
    throw new DeckError(`The deck is too large for a link (${payload.length} characters, the limit is ${MAX_PAYLOAD}).`);
  }
  return `${base.replace(/\/+$/, "")}/#deck=${DECK_FORMAT}.${payload}`;
}

/**
 * Read a deck from a link, from just its `#deck=...` part, or from the bare
 * `1.<payload>`. Throws DeckError, naming the problem, for anything that is not
 * a deck this version can read.
 */
export function readDeckLink(link: string): Deck {
  const marker = link.indexOf("deck=");
  const body = (marker === -1 ? link : link.slice(marker + 5)).trim();
  const dot = body.indexOf(".");
  if (dot === -1) throw new DeckError("The link has no format number.");
  const format = body.slice(0, dot);
  if (format !== String(DECK_FORMAT)) {
    throw new DeckError(`The link uses format ${format.slice(0, 8)}, and this version reads format ${DECK_FORMAT}.`);
  }
  const payload = body.slice(dot + 1);
  if (payload.length === 0) throw new DeckError("The link carries no cards.");
  if (payload.length > MAX_PAYLOAD) {
    throw new DeckError(`The link is too large (over ${MAX_PAYLOAD} characters).`);
  }
  const bytes = fromBase64Url(payload);
  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DeckError("The link does not hold valid text.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new DeckError("The link does not hold a deck (the JSON is broken).");
  }
  return checkDeck(raw);
}

// ── the answers ─────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local time, 24-hour: 2026-11-13 09:14. */
function stamp(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Cards with a choice. A skipped card, or none, is left open. */
export function answeredCount(stored: StoredDeck): number {
  return stored.deck.cards.filter((card) => stored.answers[card.id]?.choice !== undefined).length;
}

/**
 * The text the person pastes back to the agent. It reads well on its own: one
 * line per card, and a last line that says what "left open" means.
 */
export function formatDeckAnswers(stored: StoredDeck, at: number = Date.now()): string {
  const { deck, answers } = stored;
  const lines = deck.cards.map((card) => {
    const choice = answers[card.id]?.choice;
    const found = card.choices.find((item) => item.key === choice);
    if (!found) return `${card.id}: left open`;
    const note = found.key === card.pick ? "the agent's pick" : `changed from ${card.pick}`;
    return `${card.id}: ${found.key} = ${found.label} [${note}]`;
  });
  const answered = answeredCount(stored);
  const open = deck.cards.length - answered;
  return [
    "TetherLog answers",
    `Deck: ${deck.id} (${deck.title})`,
    `From: ${deck.from}`,
    `Answered: ${stamp(at)}`,
    "",
    ...lines,
    "",
    `${answered} of ${deck.cards.length} answered.` +
      (open > 0 ? " Left open means no decision: the agent's pick is not approved." : ""),
  ].join("\n");
}
