import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Heading, Readout, Text } from "nil-ds";
import { SampleOffer } from "../components/Sample";
import { db, getSettings } from "../db";
import { aiWeeklyDigest, buildWeeklyStats } from "../lib/agent";
import { copyText, downloadFile, shareText } from "../lib/hands";
import type { Capture } from "../types";

/**
 * Patterns, on nil-ds (D-031): the kit's Readout for each number, Heading and
 * Text for the words, Button for the controls, all in the kit's dark theme.
 *
 * WHAT MAY BE SHOWN is fixed by AGENTS.md product rule 2 and it is a product
 * rule rather than a layout one. No dial, no gauge, no target, no change arrow,
 * no day-over-day comparison, and `perDay` is never drawn as a sequence. A row
 * of daily bars with gaps in it is a streak display whatever the heading says.
 * The kit has Dial and Ring; neither belongs here.
 */

const NO_CAPTURES: Capture[] = [];

/** Every hour exists whether or not anything landed in it. */
const HOUR_LABELS = [0, 6, 12, 18];

export function PatternsView() {
  const captures = useLiveQuery(() => db.captures.toArray(), [], NO_CAPTURES);
  const settings = useLiveQuery(getSettings, [], null);
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stats = buildWeeklyStats(captures);
  const maxHeat = Math.max(...stats.heatmap, 1);
  const hasKey = Boolean(settings?.geminiApiKey);
  // Zero-padded, so it agrees with the hour labels under the distribution and
  // so midnight reads as a time rather than as an unfilled placeholder.
  const busiestHour = `${String(stats.busiestHour).padStart(2, "0")}:00`;

  async function runDigest() {
    if (!settings?.geminiApiKey) return;
    setLoading(true);
    try {
      const text = await aiWeeklyDigest(settings.geminiApiKey, stats);
      setDigest(text);
    } finally {
      setLoading(false);
    }
  }

  // Without a key the export still reads well: the same four numbers as
  // sentences, with the AI digest named as optional (D-037). Only readouts this
  // screen already shows, and no comparison with any other day.
  const plainDigest = describeStats(stats, busiestHour);
  const digestMarkdown = `# Weekly digest\n\n${digest ?? plainDigest}\n\n## Stats\n- Total captures: ${stats.totalCaptures}\n- Active days: ${stats.activeDays}\n- Busiest hour: ${busiestHour}\n- Stuck items: ${stats.stuckCount}`;

  return (
    <section
      className="tl-gutter flex flex-col gap-12 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-16"
      style={{ paddingBlock: "var(--nil-spacing-lg)" }}
    >
      <Heading
        level={1}
        className="lg:col-span-2"
        style={{ fontSize: "var(--nil-type-scale-xl)" }}
      >
        What keeps showing up
      </Heading>

      {stats.totalCaptures === 0 ? (
        <div className="flex flex-col items-start gap-12 lg:col-span-2">
          <Text muted>Nothing to see yet.</Text>
          <SampleOffer />
        </div>
      ) : (
        <>
          {/*
            TWO BY TWO ON A PHONE, FOUR ACROSS FROM 1024PX. The build spec asked
            for a row of four at 1280 and that blueprint assumed a full-width
            page. The screen was a 32rem column then, so a row of four gave each
            readout about 104px, which wrapped "TOTAL CAPTURES" onto a second
            line while its neighbours stayed on one. Below 1024px that is still
            true and it stays two by two (D-021). Beside the side rail the
            content area is about 1000px, so a row of four has room (D-039).
            Review's summary keeps the two by two: it sits in a half-width
            column.
          */}
          <section className="grid grid-cols-2 gap-x-6 gap-y-9 lg:col-span-2 lg:grid-cols-4">
            <Readout size="md" label="Total captures" value={String(stats.totalCaptures)} />
            <Readout size="md" label="Active days" value={String(stats.activeDays)} />
            <Readout size="md" label="Busiest hour" value={busiestHour} />
            <Readout size="md" label="Stuck items" value={String(stats.stuckCount)} />
          </section>

          <div className="flex min-w-0 flex-col gap-12">
          <section className="flex flex-col gap-4">
            {/* Tall as the digest's title row, which holds a 44px button, so the two titles line up. */}
            <div className="flex items-center lg:min-h-11">
              <SectionTitle>Time of day</SectionTitle>
            </div>
            <HourDistribution heatmap={stats.heatmap} max={maxHeat} />
          </section>

          {stats.topRepeats.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionTitle>Repeats</SectionTitle>
              <ul className="space-y-2">
                {stats.topRepeats.map((item) => (
                  <li
                    key={item.text}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <Text className="min-w-0 truncate">{item.text}</Text>
                    <span className="nil-label nil-label--accent shrink-0">
                      &times;{item.count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </div>
        </>
      )}

      <section className="no-print flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Weekly digest</SectionTitle>
          <Button
            variant="ghost"
            onClick={() => void runDigest()}
            disabled={!hasKey || loading}
          >
            {loading ? "Writing…" : "Generate"}
          </Button>
        </div>
        {!hasKey && (
          <Text size="sm" muted className="max-w-[70ch]">
            Add Gemini key in Settings for narrative digest. Stats above always work.
          </Text>
        )}
        {digest && <Text className="max-w-[70ch]">{digest}</Text>}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" icon="copy" onClick={() => void copyText(digestMarkdown)}>
            Copy digest
          </Button>
          <Button
            variant="ghost"
            icon="download"
            onClick={() => downloadFile("weekly-digest.md", digestMarkdown, "text/markdown")}
          >
            Download markdown
          </Button>
          <Button
            variant="ghost"
            icon="share"
            onClick={() => void shareText("Weekly digest", digest ?? digestMarkdown)}
          >
            Share
          </Button>
        </div>
      </section>
    </section>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The stats as short sentences, for the export when there is no AI digest. */
function describeStats(
  stats: ReturnType<typeof buildWeeklyStats>,
  busiestHour: string,
): string {
  if (stats.totalCaptures === 0) {
    return "No captures yet. An AI digest is optional: add a Gemini key in Settings.";
  }
  const stuck =
    stats.stuckCount === 0
      ? "Nothing keeps coming back."
      : `${plural(stats.stuckCount, "item keeps", "items keep")} coming back.`;
  return [
    `This week: ${plural(stats.totalCaptures, "capture", "captures")} across ${plural(stats.activeDays, "day", "days")}.`,
    `Busiest hour: ${busiestHour}.`,
    stuck,
    "An AI digest is optional: add a Gemini key in Settings.",
  ].join(" ");
}

/** The kit's five-step chart ramp, pale to full. A count lands on the step its share of the busiest hour reaches. */
function rampColour(count: number, max: number): string {
  const step = Math.min(5, Math.max(1, Math.ceil((count / max) * 5)));
  return `var(--nil-color-chart-ramp-${step})`;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Heading level={2} style={{ fontSize: "var(--nil-type-scale-base)" }}>
      {children}
    </Heading>
  );
}

interface HourDistributionProps {
  heatmap: number[];
  max: number;
}

/**
 * Twenty-four slots, and an empty one is VISIBLE as empty rather than absent.
 *
 * An empty hour used to be a zero-height bar at 0.15 opacity, which is nothing
 * at all: the day appeared to have fewer hours in it than it has. Every hour
 * now draws at least a 2px mark on the baseline, in the kit's muted text
 * colour, so "nothing happened here" is something you can actually see.
 * Rendering something nobody can see is worse than rendering nothing, because
 * it reads as done. See docs/DECISIONS.md D-014.
 */
function HourDistribution({ heatmap, max }: HourDistributionProps) {
  return (
    <div className="space-y-2">
      <div
        className="grid h-24 items-end gap-px"
        style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
      >
        {heatmap.map((count, hour) => (
          <div
            key={hour}
            className="tl-bar-grow"
            title={`${hour}:00, ${count === 1 ? "1 capture" : `${count} captures`}`}
            style={{
              height: count ? `max(4px, ${(count / max) * 100}%)` : "2px",
              // A count is a step on the kit's five-step blue ramp, outlined in
              // the border colour like every chart mark. An empty hour stays a
              // plain muted line: nothing was drawn there, so it has no outline.
              background: count ? rampColour(count, max) : "var(--nil-color-text-muted)",
              border: count
                ? "var(--nil-border-width) solid var(--nil-color-border)"
                : undefined,
              borderRadius: "var(--nil-radius-sm)",
              // Staggered by 8ms, so the row reads left to right once and then
              // is still. The only decorative motion in the app, and it is
              // defensible because this is a screen you arrive at to read.
              animationDelay: `${hour * 8}ms`,
            }}
          />
        ))}
      </div>
      <div
        className="nil-label grid gap-px"
        style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} style={{ gridColumn: hour + 1 }}>
            {HOUR_LABELS.includes(hour) ? String(hour).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
