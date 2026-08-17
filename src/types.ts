import { z } from "zod";

export const captureTagSchema = z.enum(["now", "later", "?"]);
export type CaptureTag = z.infer<typeof captureTagSchema>;

export const triageBucketSchema = z.enum(["do", "later", "drop", "wonder"]);
export type TriageBucket = z.infer<typeof triageBucketSchema>;

export const triageSuggestionSchema = z.object({
  captureId: z.string(),
  bucket: triageBucketSchema,
  reason: z.string(),
  carryForward: z.boolean(),
  suggestedAction: z.string().optional(),
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

export interface Capture {
  id: string;
  text: string;
  tag?: CaptureTag;
  createdAt: number;
  triagedAt?: number;
  bucket?: TriageBucket;
  reason?: string;
  suggestedAction?: string;
  carryForward?: boolean;
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
