// zod/mini, not the standard zod export. Measured 2026-09-18: standard zod 4
// costs 10.91 KB gzipped more than zod 3, mini costs 7.78 KB less. The schemas
// here are simple enough that the only API difference is z.optional(x) in place
// of x.optional(). See docs/DECISIONS.md D-012.
import * as z from "zod/mini";

export const captureTagSchema = z.enum(["now", "later", "?"]);
export type CaptureTag = z.infer<typeof captureTagSchema>;

export const triageBucketSchema = z.enum(["do", "later", "drop", "wonder"]);
export type TriageBucket = z.infer<typeof triageBucketSchema>;

export const triageSuggestionSchema = z.object({
  captureId: z.string(),
  bucket: triageBucketSchema,
  reason: z.string(),
  carryForward: z.boolean(),
  suggestedAction: z.optional(z.string()),
});

export type TriageSuggestion = z.infer<typeof triageSuggestionSchema>;

export const reviewBatchSchema = z.object({
  items: z.array(triageSuggestionSchema),
  summary: z.object({
    do: z.number(),
    later: z.number(),
    drop: z.number(),
    wonder: z.number(),
  }),
});

export type ReviewBatch = z.infer<typeof reviewBatchSchema>;

/** Voice transcript state — never blocks park. */
export type TranscriptStatus = "pending" | "ready" | "unavailable";

/** Placeholder when audio parks with no transcript yet. */
export const VOICE_TEXT_PLACEHOLDER = "[voice]";

export interface Capture {
  id: string;
  /** Always required. Use `[voice]` when audio parks without a transcript. */
  text: string;
  tag?: CaptureTag;
  createdAt: number;
  triagedAt?: number;
  bucket?: TriageBucket;
  reason?: string;
  suggestedAction?: string;
  carryForward?: boolean;
  /** Optional local audio from voice park (Dexie Blob). */
  audioBlob?: Blob;
  audioMimeType?: string;
  durationMs?: number;
  transcriptStatus?: TranscriptStatus;
  /**
   * Set only on rows loaded by "See a sample month" (D-036, D-043). A sample row is
   * never exported and Clear sample removes exactly these. Real captures never
   * carry it, so old stored data needs no migration.
   */
  sample?: boolean;
}

export interface Win {
  id: string;
  text: string;
  createdAt: number;
  reviewDate: string;
  /** See Capture.sample. */
  sample?: boolean;
}

export interface AppSettings {
  id: "settings";
  geminiApiKey?: string;
  reviewReminderHour?: number;
  reviewReminderEnabled?: boolean;
  /** The commit acknowledgment tone (D-016). On by default since D-019. */
  soundEnabled?: boolean;
}

// ── Decks (D-047) ───────────────────────────────────────────────────────────
// A deck is a set of questions an agent parks for the person to answer in Review.
// These schemas only check the shape. The limits and the cross-field rules live in
// readDeckLink (src/lib/deck.ts), so one place says what a deck may hold.

export const deckChoiceSchema = z.object({
  key: z.string(),
  label: z.string(),
  detail: z.optional(z.string()),
});

export const deckCardSchema = z.object({
  id: z.string(),
  question: z.string(),
  context: z.optional(z.string()),
  pick: z.string(),
  reason: z.string(),
  choices: z.array(deckChoiceSchema),
  link: z.optional(z.object({ href: z.string(), text: z.string() })),
});

export const deckSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  title: z.string(),
  from: z.string(),
  createdAt: z.string(),
  replyTo: z.optional(z.string()),
  cards: z.array(deckCardSchema),
});

export type DeckChoice = z.infer<typeof deckChoiceSchema>;
export type DeckCard = z.infer<typeof deckCardSchema>;
export type Deck = z.infer<typeof deckSchema>;

/** One card's answer. `skipped` is "Not now": the card is open, not decided. */
export interface DeckAnswer {
  choice?: string;
  skipped?: true;
  at: number;
}

/** A deck as stored on this device, with the answers so far. */
export interface StoredDeck {
  /** The deck's own id. The same id means the same deck. */
  id: string;
  deck: Deck;
  receivedAt: number;
  /** By card id. */
  answers: Record<string, DeckAnswer>;
  copiedAt?: number;
  closedAt?: number;
}

export type Screen = "capture" | "review" | "patterns" | "settings";

export const BUCKET_LABELS: Record<TriageBucket, string> = {
  do: "Do",
  later: "Later",
  drop: "Drop",
  wonder: "Wonder",
};

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
