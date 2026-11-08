import type { Capture, ReviewBatch, TriageSuggestion } from "../types";
import { reviewBatchSchema, VOICE_TEXT_PLACEHOLDER } from "../types";

/**
 * The one place the Gemini model is named. gemini-2.0-flash was shut down on
 * 1 June 2026 and every AI call 404'd silently into rule triage. Check
 * https://ai.google.dev/gemini-api/docs/deprecations before changing this.
 * Checked 2026-11-08: gemini-3.6-flash is Google's named replacement, stable,
 * no shutdown date announced. gemini-3.8-flash was tried first and answered
 * "high demand" (503) and then took over 45 seconds, the same evening.
 */
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Gemini 3 models think before they answer, at "medium" by default, and the
 * first test on 2026-11-08 sat on "Reviewing" with no end. Sorting a handful
 * of one-line thoughts does not need deep thought, so it runs at "minimal",
 * the lowest level Google lists for gemini-3.6-flash.
 */
const GEMINI_THINKING = { thinkingLevel: "minimal" } as const;

/**
 * No call may hang forever: past this, the person is told and rules take over.
 * Review tells them the wait up front, from this same number.
 */
export const GEMINI_TIMEOUT_MS = 20_000;

async function postGemini(apiKey: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(`Gemini took longer than ${GEMINI_TIMEOUT_MS / 1000} seconds.`, {
        cause: error,
      });
    }
    throw new Error("Could not reach Gemini. Check your connection.", { cause: error });
  }
}

/**
 * Google's own reason, in words, so a person can act on it: "API key not
 * valid" reads very differently from a bare 400. The key is never part of
 * the message, because Google does not echo it back.
 */
async function geminiError(response: Response): Promise<string> {
  let reason = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    reason = body.error?.message?.trim() ?? "";
  } catch {
    // Not JSON: keep the status code alone.
  }
  return reason
    ? `Gemini said: ${reason} (${response.status}).`
    : `Gemini request failed (${response.status}).`;
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function countRepeats(captures: Capture[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const capture of captures) {
    // An untranscribed voice note is "[voice]" whatever was said. Five different
    // thoughts would otherwise count as one thought parked five times (D-037).
    if (capture.text === VOICE_TEXT_PLACEHOLDER) continue;
    const key = normalise(capture.text);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export function getRepeatCount(text: string, captures: Capture[]): number {
  const key = normalise(text);
  return countRepeats(captures).get(key) ?? 0;
}

export function getHourHeatmap(captures: Capture[]): number[] {
  const buckets = Array.from({ length: 24 }, () => 0);

  for (const capture of captures) {
    const hour = new Date(capture.createdAt).getHours();
    buckets[hour] += 1;
  }

  return buckets;
}

export function getCapturesPerDay(captures: Capture[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const capture of captures) {
    const day = new Date(capture.createdAt).toISOString().slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }

  return map;
}

export function getStuckItems(captures: Capture[]): Capture[] {
  const repeats = countRepeats(captures);

  return captures.filter((capture) => {
    const repeatCount = repeats.get(normalise(capture.text)) ?? 0;
    const neverDropped = capture.bucket !== "drop";
    return repeatCount >= 3 && neverDropped;
  });
}

function emptySummary() {
  return { do: 0, later: 0, drop: 0, wonder: 0 };
}

function summariseItems(items: TriageSuggestion[]): ReviewBatch["summary"] {
  return items.reduce((acc, item) => {
    acc[item.bucket] += 1;
    return acc;
  }, emptySummary());
}

/** Enforce schema honesty: known IDs only, max one carryForward, summary from items. */
export function normaliseReviewBatch(
  captures: Capture[],
  items: TriageSuggestion[],
): ReviewBatch {
  const knownIds = new Set(captures.map((c) => c.id));
  const byId = new Map(
    items.filter((item) => knownIds.has(item.captureId)).map((item) => [item.captureId, item]),
  );

  // Fill any missing captures with rule hints so the batch is never partial.
  const rules = ruleBasedTriage(captures);
  for (const rule of rules.items) {
    if (!byId.has(rule.captureId)) byId.set(rule.captureId, rule);
  }

  let carryUsed = false;
  const normalised: TriageSuggestion[] = captures.map((capture) => {
    const item = byId.get(capture.id)!;
    let carryForward = item.carryForward;
    if (carryForward && carryUsed) carryForward = false;
    if (carryForward) carryUsed = true;
    return { ...item, carryForward };
  });

  // If the model never marked a carry-forward, keep the first do (if any).
  if (!carryUsed) {
    const firstDo = normalised.find((item) => item.bucket === "do");
    if (firstDo) firstDo.carryForward = true;
  }

  return reviewBatchSchema.parse({
    items: normalised,
    summary: summariseItems(normalised),
  });
}

export function ruleBasedTriage(captures: Capture[]): ReviewBatch {
  const allCaptures = captures;
  let carryUsed = false;

  const items: TriageSuggestion[] = captures.map((capture) => {
    const repeats = getRepeatCount(capture.text, allCaptures);
    let bucket: TriageSuggestion["bucket"] = "later";
    let reason = "Parked for later. Review when you have space.";
    let suggestedAction: string | undefined;
    let carryForward = false;

    if (capture.tag === "now") {
      bucket = "do";
      reason = "You tagged this Today, so a small action may help.";
      suggestedAction = "15-minute block";
    } else if (capture.tag === "?") {
      bucket = "wonder";
      reason = "A question, not a task. No action needed.";
    } else if (capture.tag === "later") {
      bucket = "later";
      reason = "You tagged this later. Leave it until you have space.";
    } else if (capture.text.trim().endsWith("?")) {
      // An untagged question is a question, not a task (D-035).
      bucket = "wonder";
      reason = "A question, not a task. No action needed.";
    } else if (repeats >= 3) {
      bucket = "drop";
      reason = `You've parked this ${repeats} times, so maybe it isn't homework.`;
    }

    if (bucket === "do" && !carryUsed) {
      carryForward = true;
      carryUsed = true;
    }

    return {
      captureId: capture.id,
      bucket,
      reason,
      carryForward,
      suggestedAction,
    };
  });

  return reviewBatchSchema.parse({ items, summary: summariseItems(items) });
}

export function buildWeeklyStats(captures: Capture[]) {
  const perDay = getCapturesPerDay(captures);
  const heatmap = getHourHeatmap(captures);
  const stuck = getStuckItems(captures);
  const repeats = [...countRepeats(captures).entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const busiestHour = heatmap.indexOf(Math.max(...heatmap));

  // The list shows the words as they were first parked, not the lower-cased key
  // the counting used (D-037).
  const firstSeen = new Map<string, string>();
  for (const capture of captures) {
    const key = normalise(capture.text);
    if (!firstSeen.has(key)) firstSeen.set(key, capture.text.trim());
  }

  return {
    totalCaptures: captures.length,
    activeDays: perDay.size,
    busiestHour,
    stuckCount: stuck.length,
    topRepeats: repeats.map(([key, count]) => ({ text: firstSeen.get(key) ?? key, count })),
    heatmap,
    perDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}

export async function aiTriageWithGemini(
  apiKey: string,
  captures: Capture[],
): Promise<ReviewBatch> {
  const prompt = captures
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id} tag=${c.tag ?? "none"} text="${c.text}"`,
    )
    .join("\n");

  const response = await postGemini(apiKey, {
    contents: [
      {
        parts: [
          {
            text: `You triage TetherLog captures for a neurodivergent user.
Return ONLY valid JSON matching this shape:
{"items":[{"captureId":"...","bucket":"do|later|drop|wonder","reason":"one warm line","carryForward":false,"suggestedAction":"optional"}],"summary":{"do":0,"later":0,"drop":0,"wonder":0}}
Rules: max one carryForward true across all items. Warm, literal, no guilt. No streak talk.

Captures:
${prompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      thinkingConfig: GEMINI_THINKING,
    },
  });

  if (!response.ok) {
    throw new Error(await geminiError(response));
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned no content");

  const parsed = reviewBatchSchema.parse(JSON.parse(raw));
  return normaliseReviewBatch(captures, parsed.items);
}

export async function aiWeeklyDigest(
  apiKey: string,
  stats: ReturnType<typeof buildWeeklyStats>,
): Promise<string> {
  const response = await postGemini(apiKey, {
    contents: [
      {
        parts: [
          {
            text: `Write a warm, literal, spare weekly digest paragraph (3-5 sentences) for a neurodivergent user's TetherLog stats. No guilt. No streaks. Observations only if data supports it.

Stats JSON:
${JSON.stringify(stats)}`,
          },
        ],
      },
    ],
    generationConfig: { thinkingConfig: GEMINI_THINKING },
  });

  if (!response.ok) {
    throw new Error(await geminiError(response));
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    "No digest this week."
  );
}
