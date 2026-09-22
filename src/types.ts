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
}

export interface Win {
  id: string;
  text: string;
  createdAt: number;
  reviewDate: string;
}

export interface AppSettings {
  id: "settings";
  geminiApiKey?: string;
  reviewReminderHour?: number;
  reviewReminderEnabled?: boolean;
  /** The commit acknowledgment tone (D-016). On by default since D-019. */
  soundEnabled?: boolean;
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
