import type { Capture, TriageBucket, Win } from "../types";
import { VOICE_TEXT_PLACEHOLDER } from "../types";
import { countRepeats } from "./agent";

/**
 * Everything Patterns says is counted here, from stored captures and wins. No AI,
 * no network, no guessing (D-043). Each finding is returned only when its data
 * is meaningful, so the screen can never show a sentence the numbers do not
 * support. Pure functions: the same rows and the same clock give the same report.
 */

/** The longest stretch Patterns looks back over. */
export const WINDOW_DAYS = 28;

/** The smallest sets each finding will speak from (D-043). */
export const MIN_CAPTURES_FOR_WHEN = 10;
export const MIN_SLOT_COUNT = 3;
export const MIN_REPEATS = 2;
/** Sorted captures needed before the group mix says anything. */
export const MIN_SORTED_FOR_MIX = 5;
/** Recent wins shown as chips. */
export const RECENT_WINS = 6;

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** "12 Oct", from a local day key. */
export function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function spokenHour(hour: number): string {
  return hour === 0 || hour === 24 ? "midnight" : String(hour);
}

/** "8 and 10", for the two hours starting at `hour`. */
export function slotWords(hour: number): string {
  return `${spokenHour(hour)} and ${spokenHour(hour + 2)}`;
}

/** The local calendar day, as YYYY-MM-DD. Not toISOString, which is UTC. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday is 0, Sunday is 6. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * The counting key for a capture's words: the same one the repeat detection in
 * lib/agent uses (trimmed, lower-cased, spaces collapsed, untranscribed voice
 * notes skipped), obtained by asking it rather than copying it.
 */
function repeatKey(capture: Capture): string | null {
  const [key] = [...countRepeats([capture]).keys()];
  return key ?? null;
}

export type LoopStatus = "done" | "letgo" | "still";

export interface Loop {
  text: string;
  /** How many times it was parked in the window. */
  count: number;
  /** Indexes into PatternsReport.days, one per day it appeared, ascending. */
  dayIndexes: number[];
  status: LoopStatus;
  /** The day it was done or let go, when it was. */
  endIndex: number | null;
}

export interface WhenFinding {
  weekday: number;
  /** First hour of the two-hour slot. */
  hour: number;
  count: number;
  /** True when another slot has as many. */
  tied: boolean;
  grid: number[][];
  /** First and last hour drawn in the heatmap. */
  firstHour: number;
  lastHour: number;
  max: number;
}

export type Group = TriageBucket | "none";

export interface MixFinding {
  /** Captures per group over the whole window. "none" is not sorted yet. */
  counts: Record<Group, number>;
  /** The largest sorted group. */
  top: TriageBucket;
  sorted: number;
  total: number;
  /** True when the top group is more than half of everything. */
  most: boolean;
}

export interface WinsFinding {
  wins: number;
  letGo: number;
  /** Newest first, at most RECENT_WINS. No dates: a win is a win. */
  recent: string[];
  more: number;
}

export interface PatternsReport {
  /** Local day keys, oldest first, ending today. */
  days: string[];
  firstDay: Date;
  lastDay: Date;
  total: number;
  winsTotal: number;
  when: WhenFinding | null;
  pulling: Loop | null;
  mix: MixFinding | null;
  winsFinding: WinsFinding | null;
  loops: Loop[];
  wonders: string[];
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, n: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function emptyBuckets(): Record<Group, number> {
  return { do: 0, later: 0, drop: 0, wonder: 0, none: 0 };
}

export function analysePatterns(
  allCaptures: Capture[],
  allWins: Win[],
  now: Date = new Date(),
): PatternsReport {
  const today = startOfDay(now);
  const floor = addDays(today, -(WINDOW_DAYS - 1));
  const endMs = addDays(today, 1).getTime();

  const captures = allCaptures
    .filter((c) => c.createdAt >= floor.getTime() && c.createdAt < endMs)
    .sort((a, b) => a.createdAt - b.createdAt);

  // The window opens on the first day with a capture, never before the floor.
  const first = captures.length ? startOfDay(new Date(captures[0].createdAt)) : today;
  const days: string[] = [];
  for (let d = new Date(first); d.getTime() <= today.getTime(); d = addDays(d, 1)) {
    days.push(localDayKey(d));
  }
  const dayIndex = new Map(days.map((key, index) => [key, index]));

  const wins = allWins.filter((w) => dayIndex.has(w.reviewDate));

  // ---- loops: the same words parked more than once ------------------------
  const groups = new Map<string, Capture[]>();
  for (const capture of captures) {
    const key = repeatKey(capture);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), capture]);
  }

  const loops: Loop[] = [];
  for (const items of groups.values()) {
    if (items.length < MIN_REPEATS) continue;
    const indexes = [
      ...new Set(items.map((c) => dayIndex.get(localDayKey(new Date(c.createdAt))) ?? 0)),
    ].sort((a, b) => a - b);
    // How it ended is read from the latest time it was parked.
    const last = items[items.length - 1];
    const status: LoopStatus =
      last.triagedAt && last.bucket === "do"
        ? "done"
        : last.triagedAt && last.bucket === "drop"
          ? "letgo"
          : "still";
    loops.push({
      text: items[0].text.trim(),
      count: items.length,
      dayIndexes: indexes,
      status,
      endIndex:
        status === "still"
          ? null
          : (dayIndex.get(localDayKey(new Date(last.createdAt))) ?? null),
    });
  }
  loops.sort(
    (a, b) =>
      b.count - a.count ||
      b.dayIndexes[b.dayIndexes.length - 1] - a.dayIndexes[a.dayIndexes.length - 1],
  );
  // A loop that was done or let go is not pulling any more, so the finding
  // takes the most repeated one that is still open.
  const pulling = loops.find((l) => l.status === "still") ?? null;

  // ---- when: the busiest two hours of the week ----------------------------
  let when: WhenFinding | null = null;
  if (captures.length >= MIN_CAPTURES_FOR_WHEN) {
    const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    let earliest = 23;
    for (const c of captures) {
      const date = new Date(c.createdAt);
      grid[weekdayIndex(date)][date.getHours()] += 1;
      earliest = Math.min(earliest, date.getHours());
    }
    let best = { weekday: 0, hour: 0, count: -1 };
    let ties = 0;
    for (let r = 0; r < 7; r += 1) {
      for (let h = 0; h < 23; h += 1) {
        const n = grid[r][h] + grid[r][h + 1];
        if (n > best.count) {
          best = { weekday: r, hour: h, count: n };
          ties = 0;
        } else if (n === best.count) {
          ties += 1;
        }
      }
    }
    if (best.count >= MIN_SLOT_COUNT) {
      when = {
        ...best,
        tied: ties > 0,
        grid,
        firstHour: Math.min(6, earliest),
        lastHour: 23,
        max: Math.max(...grid.flat()),
      };
    }
  }

  // ---- where they went: the whole window, one group each ------------------
  let mix: MixFinding | null = null;
  const counts = emptyBuckets();
  for (const c of captures) counts[c.triagedAt && c.bucket ? c.bucket : "none"] += 1;
  const sorted = captures.length - counts.none;
  if (sorted >= MIN_SORTED_FOR_MIX) {
    const order: TriageBucket[] = ["do", "later", "drop", "wonder"];
    const top = order.reduce((best, g) => (counts[g] > counts[best] ? g : best), order[0]);
    mix = { counts, top, sorted, total: captures.length, most: counts[top] * 2 > captures.length };
  }

  // ---- wins: a count and the latest few, never a sequence -----------------
  let winsFinding: WinsFinding | null = null;
  if (wins.length > 0) {
    const newest = [...wins].sort((a, b) => b.createdAt - a.createdAt);
    winsFinding = {
      wins: wins.length,
      letGo: captures.filter((c) => c.triagedAt && c.bucket === "drop").length,
      recent: newest.slice(0, RECENT_WINS).map((w) => w.text.trim()),
      more: Math.max(0, wins.length - RECENT_WINS),
    };
  }

  // ---- the wonder shelf: each question once, newest first -----------------
  const seen = new Set<string>();
  const wonders: string[] = [];
  for (const c of [...captures].reverse()) {
    if (!c.triagedAt || c.bucket !== "wonder" || c.text === VOICE_TEXT_PLACEHOLDER) continue;
    const key = repeatKey(c);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    wonders.push(c.text.trim());
  }

  return {
    days,
    firstDay: first,
    lastDay: today,
    total: captures.length,
    winsTotal: wins.length,
    when,
    pulling,
    mix,
    winsFinding,
    loops: loops.slice(0, 5),
    wonders,
  };
}

/** True when at least one finding, loop or question has data behind it. */
export function hasAnything(report: PatternsReport): boolean {
  return Boolean(
    report.when ||
      report.pulling ||
      report.mix ||
      report.winsFinding ||
      report.loops.length ||
      report.wonders.length,
  );
}
