import type { Capture, ReviewBatch, TriageSuggestion } from "../types";
import { reviewBatchSchema } from "../types";

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function countRepeats(captures: Capture[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const capture of captures) {
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
    let reason = "Parked for later — review when you have space.";
    let suggestedAction: string | undefined;
    let carryForward = false;

    if (capture.tag === "now") {
      bucket = "do";
      reason = "You tagged this now — worth a small action if you can.";
      suggestedAction = "15-minute block";
    } else if (capture.tag === "?") {
      bucket = "wonder";
      reason = "A question, not a task — no action needed tonight.";
    } else if (capture.tag === "later") {
      bucket = "later";
      reason = "You tagged this later — leave it until you have space.";
    } else if (repeats >= 3) {
      bucket = "drop";
      reason = `You've parked this ${repeats} times — maybe it isn't homework.`;
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

  return {
    totalCaptures: captures.length,
    activeDays: perDay.size,
    busiestHour,
    stuckCount: stuck.length,
    topRepeats: repeats.map(([text, count]) => ({ text, count })),
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status})`);
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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    "No digest this week."
  );
}
