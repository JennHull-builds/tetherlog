import Dexie, { type EntityTable } from "dexie";
import type { AppSettings, Capture, Deck, DeckAnswer, StoredDeck, TranscriptStatus, Win } from "../types";

export class TetherLogDB extends Dexie {
  captures!: EntityTable<Capture, "id">;
  wins!: EntityTable<Win, "id">;
  settings!: EntityTable<AppSettings, "id">;
  decks!: EntityTable<StoredDeck, "id">;

  constructor() {
    super("tetherlog");

    this.version(1).stores({
      captures: "id, createdAt, triagedAt, bucket",
      wins: "id, reviewDate, createdAt",
      settings: "id",
    });

    // v2: optional voice fields on Capture (audioBlob, audioMimeType,
    // durationMs, transcriptStatus). Same indexes — Blobs are not keyed.
    this.version(2).stores({
      captures: "id, createdAt, triagedAt, bucket",
      wins: "id, reviewDate, createdAt",
      settings: "id",
    });

    // v3 (D-047): decks of questions that agents park for Review. One new
    // table, the other three exactly as they were. A browser that has opened
    // v3 cannot be opened by older code on the same origin.
    this.version(3).stores({
      captures: "id, createdAt, triagedAt, bucket",
      wins: "id, reviewDate, createdAt",
      settings: "id",
      decks: "id, receivedAt",
    });
  }
}

export const db = new TetherLogDB();

export function createCaptureId(): string {
  return crypto.randomUUID();
}

export interface ParkCaptureOptions {
  text: string;
  tag?: Capture["tag"];
  audioBlob?: Blob;
  audioMimeType?: string;
  durationMs?: number;
  transcriptStatus?: TranscriptStatus;
}

export async function parkCapture(
  textOrOptions: string | ParkCaptureOptions,
  tag?: Capture["tag"],
): Promise<Capture> {
  const options: ParkCaptureOptions =
    typeof textOrOptions === "string"
      ? { text: textOrOptions, tag }
      : textOrOptions;

  const capture: Capture = {
    id: createCaptureId(),
    text: options.text.trim(),
    tag: options.tag,
    createdAt: Date.now(),
  };

  if (options.audioBlob) {
    capture.audioBlob = options.audioBlob;
    capture.audioMimeType = options.audioMimeType;
    capture.durationMs = options.durationMs;
    capture.transcriptStatus = options.transcriptStatus;
  }

  await db.captures.add(capture);
  return capture;
}

export async function getUntriagedCaptures(): Promise<Capture[]> {
  return db.captures.filter((c) => !c.triagedAt).toArray();
}

export async function getCapturesForDay(dayKey: string): Promise<Capture[]> {
  const start = new Date(`${dayKey}T00:00:00`).getTime();
  const end = new Date(`${dayKey}T23:59:59.999`).getTime();

  return db.captures
    .where("createdAt")
    .between(start, end, true, true)
    .reverse()
    .sortBy("createdAt");
}

export async function applyTriage(
  captureId: string,
  bucket: Capture["bucket"],
  reason: string,
  suggestedAction?: string,
  carryForward = false,
): Promise<void> {
  await db.transaction("rw", db.captures, async () => {
    // Max one carry-forward per session — clear any previous flag first.
    if (carryForward) {
      const previous = await db.captures.filter((c) => c.carryForward === true).toArray();
      await Promise.all(
        previous.map((c) => db.captures.update(c.id, { carryForward: false })),
      );
    }

    await db.captures.update(captureId, {
      triagedAt: Date.now(),
      bucket,
      reason,
      suggestedAction,
      carryForward,
    });
  });
}

export async function getWinsForDay(reviewDate: string): Promise<Win[]> {
  return db.wins.where("reviewDate").equals(reviewDate).sortBy("createdAt");
}

export async function addWin(text: string, reviewDate: string): Promise<Win> {
  const win: Win = {
    id: createCaptureId(),
    text: text.trim(),
    createdAt: Date.now(),
    reviewDate,
  };
  await db.wins.add(win);
  return win;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: "settings",
  reviewReminderEnabled: false,
  reviewReminderHour: 20,
  // ON by default, decided 2026-09-22 (D-019). It reaches anyone who has never
  // opened Settings, because that is exactly who has no stored row; a person
  // who has already turned it off has an explicit false saved and keeps it.
  soundEnabled: true,
};

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("settings");
  if (existing) return existing;

  // Keep this read-only — useLiveQuery forbids writes in the querier.
  return DEFAULT_SETTINGS;
}

export async function saveSettings(
  patch: Partial<Omit<AppSettings, "id">>,
): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.settings.put(next);
  return next;
}

export async function exportAllData() {
  // Sample rows (D-036) are never part of a backup: they are not the owner's.
  const [captures, wins, settings] = await Promise.all([
    db.captures.filter((c) => c.sample !== true).toArray(),
    db.wins.filter((w) => w.sample !== true).toArray(),
    db.settings.toArray(),
  ]);

  // The BYOK key lives on this device only and must never leave in a backup.
  const settingsForExport = settings.map((row) => {
    const copy: AppSettings = { ...row };
    delete copy.geminiApiKey;
    return copy;
  });

  // Strip Blobs — JSON backup stays text-safe; audio remains on-device in Dexie.
  const capturesForExport = captures.map((capture) => {
    const copy: Omit<Capture, "audioBlob"> & { audioBlob?: Blob } = {
      ...capture,
    };
    delete copy.audioBlob;
    return copy;
  });

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    captures: capturesForExport,
    wins,
    settings: settingsForExport,
  };
}

export async function importAllData(payload: {
  captures?: Capture[];
  wins?: Win[];
  settings?: AppSettings[];
}) {
  await db.transaction("rw", db.captures, db.wins, db.settings, async () => {
    if (payload.captures?.length) {
      await db.captures.bulkPut(payload.captures);
    }
    if (payload.wins?.length) {
      await db.wins.bulkPut(payload.wins);
    }
    if (payload.settings?.length) {
      // New backups carry no key. Keep the one already saved on this device
      // unless the backup itself holds one (older backups did), in which case
      // that key is restored as before.
      const existing = await db.settings.toArray();
      const keyById = new Map(existing.map((row) => [row.id, row.geminiApiKey]));
      await db.settings.bulkPut(
        payload.settings.map((row) =>
          row.geminiApiKey === undefined && keyById.get(row.id)
            ? { ...row, geminiApiKey: keyById.get(row.id) }
            : row,
        ),
      );
    }
  });
}

// ── decks (D-047) ───────────────────────────────────────────────────────────
// A deck is an agent's questions in transit, so none of this is in the JSON
// backup: exportAllData and importAllData do not know it exists.

/**
 * Store a deck from a link. The same id is the same deck: opening a link again
 * returns what is stored, answers and all, and never starts it over.
 */
export async function receiveDeck(deck: Deck): Promise<StoredDeck> {
  return db.transaction("rw", db.decks, async () => {
    const existing = await db.decks.get(deck.id);
    if (existing) return existing;
    const stored: StoredDeck = { id: deck.id, deck, receivedAt: Date.now(), answers: {} };
    await db.decks.add(stored);
    return stored;
  });
}

/**
 * The oldest deck that has not been closed, or null. A real deck always comes
 * before the sample deck, so the sample never stands in front of a real one.
 */
export async function getOpenDeck(): Promise<StoredDeck | null> {
  const open = await db.decks.orderBy("receivedAt").filter((d) => !d.closedAt).toArray();
  return open.find((d) => !d.sample) ?? open[0] ?? null;
}

async function changeDeck(deckId: string, change: (stored: StoredDeck) => void): Promise<void> {
  await db.transaction("rw", db.decks, async () => {
    const stored = await db.decks.get(deckId);
    if (!stored) return;
    change(stored);
    await db.decks.put(stored);
  });
}

export function answerDeckCard(deckId: string, cardId: string, answer: DeckAnswer): Promise<void> {
  return changeDeck(deckId, (stored) => {
    stored.answers[cardId] = answer;
  });
}

export function markDeckCopied(deckId: string): Promise<void> {
  return changeDeck(deckId, (stored) => {
    stored.copiedAt = Date.now();
  });
}

/** Put the cards that were left open back in front of the person. */
export function reopenDeckCards(deckId: string): Promise<void> {
  return changeDeck(deckId, (stored) => {
    for (const [cardId, answer] of Object.entries(stored.answers)) {
      if (answer.choice === undefined) delete stored.answers[cardId];
    }
  });
}

export function closeDeck(deckId: string): Promise<void> {
  return changeDeck(deckId, (stored) => {
    stored.closedAt = Date.now();
  });
}
