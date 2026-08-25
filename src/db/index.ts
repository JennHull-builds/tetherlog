import Dexie, { type EntityTable } from "dexie";
import type { AppSettings, Capture, TranscriptStatus, Win } from "../types";

export class TetherLogDB extends Dexie {
  captures!: EntityTable<Capture, "id">;
  wins!: EntityTable<Win, "id">;
  settings!: EntityTable<AppSettings, "id">;

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
  const [captures, wins, settings] = await Promise.all([
    db.captures.toArray(),
    db.wins.toArray(),
    db.settings.toArray(),
  ]);

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
    settings,
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
      await db.settings.bulkPut(payload.settings);
    }
  });
}
