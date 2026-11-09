import { db, createCaptureId } from "../db";
import type { Capture, CaptureTag, TriageBucket, Win } from "../types";
import { localDayKey } from "./patterns";

/**
 * THE SAMPLE MONTH (D-036, grown from a week in D-043). About 170 plain, kind
 * captures over the 28 days before today, and about 20 wins, so a stranger can
 * see Capture, Review and Patterns doing their job without typing anything first.
 *
 * Every row carries `sample: true`. Export skips those rows and "Clear sample"
 * removes exactly those rows, so real captures parked while the sample is
 * loaded stay real. The words here are invented: no real people (one generic
 * first name), no companies, no private details, and nothing medical.
 *
 * THE SHAPE, ALL FROM A SEEDED GENERATOR so the same day always loads the same
 * month and screenshots are stable:
 * - A rhythm. Heavier on weekday mornings, an evening bump, quieter weekends,
 *   and a little quieter week by week. Mondays start busy.
 * - Five loops, each the same words parked again on later days: three that are
 *   still pulling and two that were done, plus one let go.
 * - Almost everything is already sorted (triagedAt and a group set), the way a
 *   person's earlier evenings would have left it.
 * - TODAY and the last evening of YESTERDAY stay unsorted, so Review has a
 *   queue at any time of day. Today's rows are stamped minutes before the moment
 *   of loading and never cross midnight.
 */

interface LoopSpec {
  text: string;
  /** Days into the 28 (0 is the oldest, 27 is yesterday) on which it was parked. */
  days: number[];
  /** The group of the last time. Every earlier time was put off to Later. */
  last: TriageBucket;
}

// Day 0 is left empty on purpose: Patterns looks back 28 days counting today, so
// the oldest sample day sits just outside it and a loop there would lose a count.
const LOOPS: LoopSpec[] = [
  { text: "Reorganise the spice rack", days: [1, 4, 8, 11, 15, 19, 24], last: "later" },
  { text: "Sort out the photos on my phone", days: [2, 8, 13, 20, 26], last: "later" },
  { text: "Call the dentist about Friday", days: [2, 5, 9, 17], last: "do" },
  { text: "Reply to Sam's long message", days: [4, 11, 18], last: "do" },
  { text: "Start running again", days: [6, 14, 21], last: "drop" },
];

const POOLS: Record<TriageBucket, string[]> = {
  do: [
    "Book the car service",
    "Reply to the plumber about Thursday",
    "Pick up milk and bread",
    "Send the invoice",
    "Order printer ink",
    "Pay the electricity bill",
    "Email the landlord about the geyser",
    "Renew the car licence disc",
    "Buy a birthday card for Gran",
    "Post the parcel before the post office shuts",
    "Return the library books",
    "Call the bank about my card",
    "Book a haircut",
    "Buy lightbulbs for the hallway",
    "Take the recycling out",
    "Buy stamps",
    "Wash the car",
    "Plan the week's meals",
    "Water the herbs",
    "Charge the camera battery",
    "Print the forms for Monday",
    "Pay the water bill",
    "Pick up the dry cleaning",
    "Order a new phone charger",
    "Text the neighbour about the parcel",
    "Fill in the tax paperwork",
    "Buy dog food",
    "Refill the prescription",
    "Put the bins out tonight",
    "Book the vet appointment",
    "Cancel the old subscription",
    "Buy a gift for the housewarming",
    "Change the batteries in the smoke alarm",
    "Reply to the school email",
    "Collect the keys from the repair shop",
    "Wrap the present",
    "Take the suitcase down from the cupboard",
    "Renew the library card",
    "Buy a new sponge and dish soap",
    "Send the photos to the family chat",
    "Check the tyre pressure",
    "Pack the gym bag",
    "Defrost something for dinner",
    "Sign and scan the lease",
    "Top up the airtime",
    "Order the groceries online",
    "Find a plumber for the tap",
    "Update the shopping list",
    "Write down the wifi password for the guests",
    "Message the group about Saturday",
    "Buy sunscreen",
    "Pick up the spare key",
    "Empty the dishwasher",
    "Pay the parking fine",
    "Make an appointment for the eye test",
    "Take the old paint to the drop-off",
    "Buy envelopes",
    "Collect the parcel from the depot",
    "Hand in the form at the office",
    "Buy a new toothbrush",
    "Water the plants on the balcony",
    "Iron the shirt for tomorrow",
  ],
  later: [
    "Clean out the garage",
    "Update my CV",
    "Fix the wobbly chair",
    "Plan the December trip",
    "Back up the laptop",
    "Look up hiking trails near the dam",
    "Clear out the bookshelf",
    "Defrost the freezer",
    "Clean the bathroom extractor fan",
    "Sort the winter clothes",
    "Paint the spare room",
    "Learn to make a proper flat white",
    "Fix the squeaky door",
    "Go through the box of cables",
    "Replace the shower curtain",
    "Organise the tool drawer",
    "Write the thank you notes",
    "Plan the weekend away",
    "Find a good podcast for the commute",
    "Re-pot the big plant",
    "Clean the oven properly",
    "Make a photo book of the trip",
    "Scan the old family photos",
    "Look into a standing desk mat",
    "Try the new recipe for lentil soup",
    "Tidy the files on the desktop",
    "Sharpen the kitchen knives",
    "Wash the curtains",
    "Sew the button back on the coat",
    "Find the charger for the old camera",
    "Write a list of films to watch",
    "Clean the car's interior",
    "Mend the torn bag strap",
    "Sort the drawer of odd socks",
    "Plan a birthday dinner",
    "Make the guest bed",
  ],
  drop: [
    "Check what that old colleague is up to",
    "Reorganise the bookshelf by colour",
    "Look up that series everyone's watching",
    "Redo the garden layout",
    "Compare phone contracts again",
    "Read the whole article about coffee beans",
    "Rearrange the living room again",
    "Look at flights to somewhere far away",
    "Make a spreadsheet of my spreadsheets",
    "Watch the whole documentary about bridges",
    "Rename all the folders",
    "Buy a bigger bookcase",
    "Look up what that old song was called",
    "Try a new colour for the hallway",
    "Learn every capital city",
    "Order another notebook",
    "Check the weather for next month",
    "Look up a faster route to the shops",
    "Find a new font for the shopping list",
    "Design a better filing system",
    "Compare three kinds of kettle",
    "Sort the spice jars by country",
    "Watch one more video about sourdough",
    "Check the price of that lamp again",
    "Reread the old group chat",
    "Plan a perfect morning routine",
    "Look for a hobby that costs nothing",
    "Make a playlist for the perfect Sunday",
    "Search for a cheaper fridge",
    "Look into learning the cello",
    "Test five different pens",
    "Redraw the weekly planner",
  ],
  wonder: [
    "Why do the best ideas arrive in the shower?",
    "Is it worth switching to a standing desk?",
    "How do octopuses taste with their arms?",
    "Why is dusk so pink?",
    "Could I learn piano at 40?",
    "Do dogs dream in colour?",
    "What makes a sourdough starter go sour?",
    "Do bees remember faces?",
    "Why does Monday feel longer than Friday?",
    "How do people remember their dreams?",
    "What was that podcast about sleep called?",
    "Where does the wind come from?",
    "Why do cats knead blankets?",
    "How do birds know when to leave?",
    "Why do I forget words in the middle of a sentence?",
    "What would a month without screens feel like?",
    "How is the moon so bright on some nights?",
    "Why does coffee smell better than it tastes?",
    "Why do some people wake before their alarm?",
    "How deep is the sea near the harbour?",
    "Why do clocks go forward in some places?",
    "What makes a good first line?",
    "How long does it take for a seed to sprout?",
    "Why do some songs get stuck?",
  ],
};

/** Plain items that sit unsorted, for the last evening of yesterday and for today. */
const YESTERDAY_ROWS: { at: string; text: string; tag?: CaptureTag }[] = [
  { at: "19:10", text: "Look up the times for the Saturday market" },
  { at: "20:20", text: "Why do the streetlights flicker at night?" },
  { at: "21:05", text: "Put the clean towels away", tag: "now" },
];

const TODAY_ROWS: { minutesAgo: number; text: string; tag?: CaptureTag }[] = [
  { minutesAgo: 170, text: "Reply to the electrician about the quote", tag: "now" },
  { minutesAgo: 140, text: "Is it worth getting a second monitor?" },
  { minutesAgo: 105, text: "Buy a new kettle filter" },
  { minutesAgo: 75, text: "Check the opening hours for the garden centre" },
  { minutesAgo: 40, text: "How do swifts sleep while flying?" },
  { minutesAgo: 12, text: "Book the window cleaner", tag: "now" },
];

const WIN_TEXTS = [
  "Took a proper lunch break",
  "Went for a short walk",
  "Cleared the kitchen counter",
  "Called the bank and sorted the card",
  "Did the laundry and put it away",
  "Drank enough water",
  "Replied to an email I had been avoiding",
  "Made a proper breakfast",
  "Paid the electricity bill",
  "Went to bed on time",
  "Stretched for ten minutes",
  "Cooked dinner from scratch",
  "Tidied my desk",
  "Sat outside for a bit",
  "Wrote the shopping list",
  "Sorted the pile of post",
  "Did the dishes before bed",
  "Called a friend",
  "Changed the bed sheets",
  "Backed up my phone",
  "Took the recycling out",
  "Watered the plants",
  "Booked the car service",
  "Wiped down the bathroom",
  "Finished the book chapter",
];

/** The shape of an ordinary day, hour by hour: a morning peak and an evening one. */
const HOUR_WEIGHT = [
  0, 0, 0, 0, 0, 0, 1, 4, 9, 10, 5, 3, 3, 2, 2, 3, 3, 3, 4, 5, 7, 7, 4, 1,
];
/** Captures on an average day by weekday, Monday first. */
const WEEKDAY_BASE = [8.5, 6.5, 5, 5, 4.5, 3, 3];
/** The first week is the busiest and each one is a little quieter. */
const WEEK_FACTOR = [1.2, 1.05, 0.95, 0.8];
const BUCKET_SHARE: [TriageBucket, number][] = [
  ["do", 0.4],
  ["later", 0.24],
  ["drop", 0.2],
  ["wonder", 0.16],
];

const SAMPLE_DAYS = 28;

/** mulberry32: a small seeded generator, so the same month loads every time. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function atClock(daysAgo: number, hour: number, minute: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function weekdayOf(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export async function hasSampleData(): Promise<boolean> {
  return (await db.captures.filter((c) => c.sample === true).count()) > 0;
}

/** Builds the month. Exported so a test can count it without touching the database. */
export function buildSampleMonth(now: number = Date.now()): { captures: Capture[]; wins: Win[] } {
  const random = seeded(20261109);

  function pickHour(weekend: boolean): number {
    const weights = HOUR_WEIGHT.map((w, h) =>
      weekend ? (h >= 9 && h <= 21 ? w * 0.6 + 2 : w * 0.4) : w,
    );
    let r = random() * weights.reduce((a, b) => a + b, 0);
    for (let h = 0; h < 24; h += 1) {
      r -= weights[h];
      if (r <= 0) return h;
    }
    return 20;
  }

  const pools = new Map<TriageBucket, string[]>(
    (Object.keys(POOLS) as TriageBucket[]).map((b) => [b, shuffled(POOLS[b], random)]),
  );
  function nextText(): { bucket: TriageBucket; text: string } | null {
    let r = random();
    let bucket = BUCKET_SHARE[BUCKET_SHARE.length - 1][0];
    for (const [b, share] of BUCKET_SHARE) {
      if (r < share) {
        bucket = b;
        break;
      }
      r -= share;
    }
    // A group that has run out lends the next one that has not.
    const available = BUCKET_SHARE.map(([b]) => b).filter((b) => (pools.get(b)?.length ?? 0) > 0);
    if (!available.includes(bucket)) bucket = available[0];
    return bucket ? { bucket, text: pools.get(bucket)!.pop()! } : null;
  }

  /** Sorted that evening, which is when Review is meant to be done. */
  function sorted(created: Date, bucket: TriageBucket, tag?: CaptureTag): Capture {
    const evening = new Date(created);
    evening.setHours(22, 0, 0, 0);
    return {
      id: createCaptureId(),
      text: "",
      tag,
      createdAt: created.getTime(),
      triagedAt: Math.max(evening.getTime(), created.getTime() + 60_000),
      bucket,
      carryForward: false,
      sample: true,
    };
  }

  const captures: Capture[] = [];

  for (let d = 0; d < SAMPLE_DAYS; d += 1) {
    const daysAgo = SAMPLE_DAYS - d;
    const date = atClock(daysAgo, 12, 0);
    const weekday = weekdayOf(date);
    const base = WEEKDAY_BASE[weekday] * WEEK_FACTOR[Math.floor(d / 7)];
    const count = Math.max(1, Math.round(base + (random() - 0.5) * 2));
    for (let i = 0; i < count; i += 1) {
      const next = nextText();
      if (!next) continue;
      const { bucket, text } = next;
      // Mondays begin with a rush before ten.
      const hour = weekday === 0 && i < 4 ? 8 + Math.floor(random() * 2) : pickHour(weekday >= 5);
      const created = atClock(daysAgo, hour, Math.floor(random() * 60));
      const tag: CaptureTag | undefined = bucket === "do" && random() < 0.2 ? "now" : undefined;
      captures.push({ ...sorted(created, bucket, tag), text });
    }
  }

  for (const loop of LOOPS) {
    loop.days.forEach((d, i) => {
      const daysAgo = SAMPLE_DAYS - d;
      const weekday = weekdayOf(atClock(daysAgo, 12, 0));
      const created = atClock(daysAgo, pickHour(weekday >= 5), Math.floor(random() * 60));
      const bucket: TriageBucket = i === loop.days.length - 1 ? loop.last : "later";
      captures.push({ ...sorted(created, bucket), text: loop.text });
    });
  }

  for (const row of YESTERDAY_ROWS) {
    const [hour, minute] = row.at.split(":").map(Number);
    captures.push({
      id: createCaptureId(),
      text: row.text,
      tag: row.tag,
      createdAt: atClock(1, hour, minute).getTime(),
      sample: true,
    });
  }

  // Today's rows never cross midnight into yesterday: clamp to the local day
  // and keep their order with a minute between them.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  TODAY_ROWS.forEach((row, index) => {
    captures.push({
      id: createCaptureId(),
      text: row.text,
      tag: row.tag,
      createdAt: Math.max(
        now - row.minutesAgo * 60_000,
        startOfToday.getTime() + (index + 1) * 60_000,
      ),
      sample: true,
    });
  });

  // About twenty wins, one or two on roughly half the days, a bit more often
  // towards the end. reviewDate is the local day the win belongs to.
  const winTexts = shuffled(WIN_TEXTS, random);
  const wins: Win[] = [];
  for (let d = 0; d < SAMPLE_DAYS; d += 1) {
    const chance = [0.6, 0.65, 0.7, 0.75][Math.floor(d / 7)];
    if (random() >= chance) continue;
    const perDay = random() < 0.2 ? 2 : 1;
    for (let k = 0; k < perDay; k += 1) {
      const daysAgo = SAMPLE_DAYS - d;
      const text = winTexts[wins.length % winTexts.length];
      wins.push({
        id: createCaptureId(),
        text,
        createdAt: atClock(daysAgo, 20, 30 + k).getTime(),
        reviewDate: localDayKey(atClock(daysAgo, 12, 0)),
        sample: true,
      });
    }
  }

  return { captures, wins };
}

/** Loads the sample month. A second call while it is loaded does nothing. */
export async function loadSampleMonth(): Promise<void> {
  if (await hasSampleData()) return;
  const { captures, wins } = buildSampleMonth();

  await db.transaction("rw", db.captures, db.wins, async () => {
    await db.captures.bulkAdd(captures);
    await db.wins.bulkAdd(wins);
  });
}

/** Removes exactly the sample rows. Everything the owner parked is untouched. */
export async function clearSampleMonth(): Promise<void> {
  await db.transaction("rw", db.captures, db.wins, async () => {
    await db.captures.filter((c) => c.sample === true).delete();
    await db.wins.filter((w) => w.sample === true).delete();
  });
}
