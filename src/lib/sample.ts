import { db, createCaptureId } from "../db";
import type { Capture, CaptureTag, Win } from "../types";
import { ruleBasedTriage } from "./agent";

/**
 * THE SAMPLE WEEK (D-036). About forty plain, kind captures over the past seven
 * days and a few wins, so a stranger can see Capture, Review and Patterns doing
 * their job without typing anything first.
 *
 * Every row carries `sample: true`. Export skips those rows and "Clear sample"
 * removes exactly those rows, so real captures parked while the sample is
 * loaded stay real. The words here are invented: no real people, companies or
 * private details, and nothing medical.
 *
 * TWO KINDS OF ROW:
 * - TODAY, stamped minutes before the moment it is loaded and left untriaged,
 *   so Review always has a queue to sort whatever the time of day. The three
 *   repeats sit here on purpose: rule triage only counts repeats inside the
 *   set it is handed (today's queue), so spread over days the "drop" suggestion
 *   would never show.
 * - THE SIX DAYS BEFORE, at fixed clock times and already sorted by the same
 *   rules, so the hour chart keeps one shape (a morning peak and an evening
 *   one) however often it is loaded.
 */

interface PastRow {
  /** Days before today. */
  daysAgo: number;
  /** Local clock time, "HH:MM". */
  at: string;
  text: string;
  tag?: CaptureTag;
}

interface TodayRow {
  /** Minutes before the moment of loading. */
  minutesAgo: number;
  text: string;
  tag?: CaptureTag;
}

const TODAY_ROWS: TodayRow[] = [
  { minutesAgo: 170, text: "Reply to the plumber about Thursday", tag: "now" },
  { minutesAgo: 150, text: "Reorganise the spice rack" },
  { minutesAgo: 125, text: "Is it worth switching to a standing desk?" },
  { minutesAgo: 100, text: "Pick up milk and bread" },
  { minutesAgo: 75, text: "Reorganise the spice rack" },
  { minutesAgo: 50, text: "Book the car service", tag: "now" },
  { minutesAgo: 30, text: "Why do the best ideas arrive in the shower?" },
  { minutesAgo: 10, text: "Reorganise the spice rack" },
];

const PAST_ROWS: PastRow[] = [
  { daysAgo: 1, at: "08:15", text: "Email the landlord about the geyser", tag: "now" },
  { daysAgo: 1, at: "08:50", text: "Order printer ink" },
  { daysAgo: 1, at: "09:30", text: "What was that podcast about sleep called?" },
  { daysAgo: 1, at: "12:40", text: "Water the herbs" },
  { daysAgo: 1, at: "19:45", text: "Plan Sunday lunch" },
  { daysAgo: 1, at: "20:30", text: "Fix the wobbly shelf" },

  { daysAgo: 2, at: "08:05", text: "Renew the car licence disc", tag: "now" },
  { daysAgo: 2, at: "09:10", text: "Sort out the photos on my phone", tag: "later" },
  { daysAgo: 2, at: "10:20", text: "Do bees remember faces?" },
  { daysAgo: 2, at: "15:30", text: "Buy a birthday card for Gran", tag: "now" },
  { daysAgo: 2, at: "19:15", text: "Learn to make a proper flat white" },
  { daysAgo: 2, at: "21:00", text: "Clean the bathroom extractor fan" },

  { daysAgo: 3, at: "08:40", text: "Write down the wifi password for the guests" },
  { daysAgo: 3, at: "09:05", text: "Return the library books", tag: "now" },
  { daysAgo: 3, at: "09:45", text: "Is it too late to start piano?" },
  { daysAgo: 3, at: "13:10", text: "Look up hiking trails near the dam", tag: "later" },
  { daysAgo: 3, at: "20:05", text: "Sort out the photos on my phone", tag: "later" },
  { daysAgo: 3, at: "20:50", text: "Defrost the freezer" },

  { daysAgo: 4, at: "08:25", text: "Call the bank about my card", tag: "now" },
  { daysAgo: 4, at: "09:35", text: "Find the charger for the old camera" },
  { daysAgo: 4, at: "10:05", text: "What makes a sourdough starter go sour?" },
  { daysAgo: 4, at: "18:55", text: "Plan the week's meals" },
  { daysAgo: 4, at: "19:40", text: "Wash the car" },

  { daysAgo: 5, at: "07:55", text: "Post the parcel before the post office shuts", tag: "now" },
  { daysAgo: 5, at: "09:20", text: "Book a haircut" },
  { daysAgo: 5, at: "10:15", text: "Why does Monday feel longer than Friday?" },
  { daysAgo: 5, at: "14:00", text: "Buy lightbulbs for the hallway" },
  { daysAgo: 5, at: "19:30", text: "Back up the laptop", tag: "now" },
  { daysAgo: 5, at: "21:10", text: "Clear out the bookshelf" },

  { daysAgo: 6, at: "08:45", text: "Buy stamps" },
  { daysAgo: 6, at: "09:50", text: "Where did I put the spare key?" },
  { daysAgo: 6, at: "19:20", text: "Take the recycling out", tag: "now" },
  { daysAgo: 6, at: "20:15", text: "Look into a new pair of running shoes" },
  { daysAgo: 6, at: "20:40", text: "How do people remember their dreams?" },
];

/** reviewDate is how Review finds a day's wins, so it is the local day key. */
interface WinRow {
  daysAgo: number;
  text: string;
}

const WIN_ROWS: WinRow[] = [
  { daysAgo: 0, text: "Took a proper lunch break" },
  { daysAgo: 0, text: "Went for a short walk" },
  { daysAgo: 0, text: "Cleared the kitchen counter" },
  { daysAgo: 2, text: "Renewed the car licence disc" },
  { daysAgo: 4, text: "Called the bank and sorted the card" },
];

function atClock(daysAgo: number, clock: string): Date {
  const [hours, minutes] = clock.split(":").map(Number);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** The same day key `getCapturesForDay` and the wins queries compare against. */
function dayKeyFor(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export async function hasSampleData(): Promise<boolean> {
  return (await db.captures.filter((c) => c.sample === true).count()) > 0;
}

/** Loads the sample week. A second call while it is loaded does nothing. */
export async function loadSampleWeek(): Promise<void> {
  if (await hasSampleData()) return;

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Today's rows never cross midnight into yesterday: clamp to the local day
  // and keep their order with a minute between them.
  const today: Capture[] = TODAY_ROWS.map((row, index) => ({
    id: createCaptureId(),
    text: row.text,
    tag: row.tag,
    createdAt: Math.max(
      now - row.minutesAgo * 60_000,
      startOfToday.getTime() + (index + 1) * 60_000,
    ),
    sample: true,
  }));

  const past: Capture[] = PAST_ROWS.map((row) => ({
    id: createCaptureId(),
    text: row.text,
    tag: row.tag,
    createdAt: atClock(row.daysAgo, row.at).getTime(),
    sample: true,
  }));

  // The earlier days are already sorted, by the same rules a person sees in
  // Review. No carry-forward: the owner's own is never displaced by a sample.
  const sorted = new Map(
    ruleBasedTriage(past).items.map((item) => [item.captureId, item]),
  );
  const triaged = past.map((capture) => {
    const item = sorted.get(capture.id);
    const day = new Date(capture.createdAt);
    day.setHours(22, 0, 0, 0);
    return {
      ...capture,
      triagedAt: day.getTime(),
      bucket: item?.bucket ?? "later",
      reason: item?.reason,
      suggestedAction: item?.suggestedAction,
      carryForward: false,
    } satisfies Capture;
  });

  const wins: Win[] = WIN_ROWS.map((row) => ({
    id: createCaptureId(),
    text: row.text,
    createdAt:
      row.daysAgo === 0
        ? now - 5 * 60_000
        : atClock(row.daysAgo, "20:30").getTime(),
    reviewDate: dayKeyFor(row.daysAgo),
    sample: true,
  }));

  await db.transaction("rw", db.captures, db.wins, async () => {
    await db.captures.bulkAdd([...triaged, ...today]);
    await db.wins.bulkAdd(wins);
  });
}

/** Removes exactly the sample rows. Everything the owner parked is untouched. */
export async function clearSampleWeek(): Promise<void> {
  await db.transaction("rw", db.captures, db.wins, async () => {
    await db.captures.filter((c) => c.sample === true).delete();
    await db.wins.filter((w) => w.sample === true).delete();
  });
}
