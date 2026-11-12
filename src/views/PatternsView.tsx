import { useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, Heading, Text } from "nil-ds";
import {
  DayStrip,
  GroupLegend,
  HeatmapChart,
  MixChart,
} from "../components/PatternCharts";
import { SampleOffer } from "../components/Sample";
import { CopyButton } from "../components/ui";
import { db, getSettings } from "../db";
import { aiWeeklyDigest, buildWeeklyStats, GEMINI_TIMEOUT_MS } from "../lib/agent";
import { downloadFile, shareText } from "../lib/hands";
import {
  WEEKDAY_NAMES,
  WINDOW_DAYS,
  analysePatterns,
  dayLabel,
  hasAnything,
  slotWords,
} from "../lib/patterns";
import type { Capture, TriageBucket, Win } from "../types";

/**
 * Patterns, findings first (D-043). Up to four plain sentences, each with the
 * small picture that proves it, then the loops and the questions parked on the
 * wonder shelf, then the optional digest. Every sentence and number is counted
 * from stored captures and wins in lib/patterns.ts; nothing here is written by
 * an AI and nothing is shown unless the data behind it is meaningful.
 *
 * THE TONE IS THE RULE. A loop is "still", never "failed". Letting go is a
 * result. No target, no score, no streak, no day-by-day sequence and no
 * comparison of one stretch with another (AGENTS.md product rule 2, D-043).
 */

const NO_CAPTURES: Capture[] = [];
const NO_WINS: Win[] = [];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function shorten(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function slotWord(hour: number): string {
  if (hour < 5 || hour >= 21) return "nights";
  if (hour < 12) return "mornings";
  if (hour < 17) return "afternoons";
  return "evenings";
}

export function PatternsView() {
  const captures = useLiveQuery(() => db.captures.toArray(), [], NO_CAPTURES);
  const wins = useLiveQuery(() => db.wins.toArray(), [], NO_WINS);
  const settings = useLiveQuery(getSettings, [], null);
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  const report = useMemo(() => analysePatterns(captures, wins), [captures, wins]);
  const stats = buildWeeklyStats(captures);
  const hasKey = Boolean(settings?.geminiApiKey);
  // Zero-padded, so it agrees with the hour labels and so midnight reads as a
  // time rather than as an unfilled placeholder.
  const busiestHour = `${String(stats.busiestHour).padStart(2, "0")}:00`;

  async function runDigest() {
    if (!settings?.geminiApiKey) return;
    setLoading(true);
    setDigestError(null);
    try {
      const text = await aiWeeklyDigest(settings.geminiApiKey, stats);
      setDigest(text);
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // Without a key the export still reads well: the same numbers as sentences,
  // with the AI digest named as optional (D-037). No comparison with any other day.
  const plainDigest = describeStats(stats, busiestHour);
  const digestMarkdown = `# Weekly digest\n\n${digest ?? plainDigest}\n\n## Stats\n- Total captures: ${stats.totalCaptures}\n- Active days: ${stats.activeDays}\n- Busiest hour: ${busiestHour}\n- Stuck items: ${stats.stuckCount}`;

  const length = report.days.length;
  const span =
    length >= WINDOW_DAYS
      ? "Your last four weeks"
      : length === 1
        ? "Today"
        : `Your last ${length} days`;
  const range =
    length === 1
      ? dayLabel(report.days[0])
      : `${dayLabel(report.days[0])} to ${dayLabel(report.days[length - 1])}`;
  const anything = hasAnything(report);
  const { when, pulling, mix, winsFinding } = report;
  const anyFinding = Boolean(when || pulling || mix || winsFinding);

  return (
    <section
      className="tl-gutter flex flex-col gap-8"
      style={{ paddingBlock: "var(--nil-spacing-lg)" }}
    >
      <div className="flex flex-col gap-2">
        <Heading level={1} style={{ fontSize: "var(--nil-type-scale-xl)" }}>
          What keeps showing up
        </Heading>
        {report.total > 0 && (
          <Text size="sm" muted>
            {`${span}, ${range}. ${plural(report.total, "thought", "thoughts")} parked, ${plural(report.winsTotal, "win", "wins")}.`}
          </Text>
        )}
      </div>

      {!anything ? (
        <div className="flex flex-col items-start gap-4">
          <Text className="max-w-[60ch]">
            Patterns appear after a week or so of parking thoughts. Try the sample month to see
            what this looks like.
          </Text>
          <SampleOffer />
        </div>
      ) : (
        <>
          {anyFinding && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {when && (
                <Finding label="When">
                  <p className="m-0">
                    <strong>
                      {`${WEEKDAY_NAMES[when.weekday]} ${slotWord(when.hour)} pull hardest.`}
                    </strong>{" "}
                    {`${plural(when.count, "thought", "thoughts")} landed between ${slotWords(when.hour)} on ${WEEKDAY_NAMES[when.weekday]}s, ${when.tied ? "at least as many as" : "more than"} any other two hours of the week.`}
                  </p>
                  <HeatmapChart when={when} />
                </Finding>
              )}

              {pulling && (
                <Finding label="Still pulling">
                  <p className="m-0">
                    <strong>{`“${shorten(pulling.text)}” came back ${pulling.count} times.`}</strong>{" "}
                    It might want a slot of its own, or permission to go.
                  </p>
                  <DayStrip
                    length={length}
                    dayIndexes={pulling.dayIndexes}
                    days={report.days}
                    label={`The days it came back: ${pulling.dayIndexes.map((i) => dayLabel(report.days[i])).join(", ")}.`}
                  />
                  <Text size="sm" muted className="m-0">
                    Each block is a day it came back.
                  </Text>
                </Finding>
              )}

              {mix && (
                <Finding label="Where they went">
                  <p className="m-0">
                    <strong>{`${mix.most ? "Most thoughts were" : "The biggest group was"} ${GROUP_PHRASE[mix.top]}:`}</strong>{" "}
                    {`${mix.counts[mix.top]} of ${mix.total}.`}
                  </p>
                  <MixChart finding={mix} />
                  <GroupLegend counts={mix.counts} />
                </Finding>
              )}

              {winsFinding && (
                <Finding label="Wins">
                  <p className="m-0">
                    <strong>{`${plural(winsFinding.wins, "win", "wins")} ${length >= WINDOW_DAYS ? "this month" : "so far"}.`}</strong>
                    {winsFinding.letGo > 0 &&
                      ` You let go of ${plural(winsFinding.letGo, "thing", "things")} on purpose. That counts too.`}
                  </p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Recent wins">
                    {winsFinding.recent.map((text, i) => (
                      <li
                        key={`${i}-${text}`}
                        className="min-w-0 break-words"
                        style={{
                          background: "var(--nil-color-surface)",
                          color: "var(--nil-color-text)",
                          border: "var(--nil-border-width) solid var(--nil-color-success)",
                          borderLeftWidth: "var(--nil-spacing-xs)",
                          borderRadius: "var(--nil-radius-default)",
                          padding: "var(--nil-spacing-xs) var(--nil-spacing-sm)",
                          fontSize: "var(--nil-type-scale-sm)",
                        }}
                      >
                        {text}
                      </li>
                    ))}
                  </ul>
                  {winsFinding.more > 0 && (
                    <Text size="sm" muted className="m-0">
                      {`and ${winsFinding.more} more`}
                    </Text>
                  )}
                </Finding>
              )}
            </div>
          )}

          {(report.loops.length > 0 || report.wonders.length > 0) && (
            <div className="grid grid-cols-1 items-start gap-8 pt-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-x-12">
              {report.loops.length > 0 && (
                <section className="flex min-w-0 flex-col gap-3">
                  <SectionTitle>Loops</SectionTitle>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {report.loops.map((loop) => (
                      <li
                        key={loop.text}
                        className="grid items-center gap-x-3 py-2 grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] lg:grid-cols-[minmax(0,1fr)_9.5rem_5rem]"
                        style={{ borderBottom: "1px solid var(--nil-color-grid-line)" }}
                      >
                        <Text size="sm" className="m-0 min-w-0 break-words">
                          {loop.text}
                        </Text>
                        <DayStrip
                          length={length}
                          dayIndexes={loop.dayIndexes}
                          status={loop.status}
                          endIndex={loop.endIndex}
                          label={`The days it came back: ${loop.dayIndexes.map((i) => dayLabel(report.days[i])).join(", ")}.`}
                        />
                        <span
                          className={`nil-label text-right ${loop.status === "done" ? "nil-label--accent" : ""}`}
                        >
                          {loop.status === "done"
                            ? "Done"
                            : loop.status === "letgo"
                              ? "Let go"
                              : `${loop.count}× still`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Text size="sm" muted className="m-0">
                    Each block is a day it came back. Blue is the day it got done, orange the day
                    you let it go.
                  </Text>
                </section>
              )}

              {report.wonders.length > 0 && (
                <section className="flex min-w-0 flex-col gap-3">
                  <SectionTitle>Wonder shelf</SectionTitle>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {report.wonders.slice(0, MAX_WONDERS).map((text) => (
                      <li
                        key={text}
                        className="min-w-0 break-words"
                        style={{
                          background: "var(--nil-color-chart-blue-pale)",
                          color: "var(--nil-color-chart-blue-pale-text)",
                          border: "var(--nil-border-width) solid var(--nil-color-border)",
                          borderRadius: "var(--nil-radius-default)",
                          padding: "var(--nil-spacing-xs) var(--nil-spacing-sm)",
                          fontSize: "var(--nil-type-scale-sm)",
                        }}
                      >
                        {text}
                      </li>
                    ))}
                  </ul>
                  {report.wonders.length > MAX_WONDERS && (
                    <Text size="sm" muted className="m-0">
                      {`and ${report.wonders.length - MAX_WONDERS} more`}
                    </Text>
                  )}
                  <Text size="sm" muted className="m-0">
                    Questions you parked. Nothing to do, just yours.
                  </Text>
                </section>
              )}
            </div>
          )}
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
        {loading && (
          <Text size="sm" muted role="status" className="max-w-[70ch]">
            {`Gemini is writing. This can take up to ${GEMINI_TIMEOUT_MS / 1000} seconds.`}
            <span
              className="nil-cursor-blink"
              aria-hidden
              style={{ color: "var(--nil-color-text-accent)", marginLeft: "var(--nil-spacing-xs)" }}
            >
              ▌
            </span>
          </Text>
        )}
        {!loading && digestError && (
          <Text
            size="sm"
            role="alert"
            className="max-w-[70ch]"
            style={{ color: "var(--nil-color-text-danger)" }}
          >
            {digestError}
          </Text>
        )}
        {!hasKey && (
          <Text size="sm" muted className="max-w-[70ch]">
            Add Gemini key in Settings for narrative digest. The findings above always work.
          </Text>
        )}
        {digest && <Text className="max-w-[70ch]">{digest}</Text>}
        <div className="flex flex-wrap gap-2">
          <CopyButton getText={() => digestMarkdown}>Copy digest</CopyButton>
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

/** More than this and the shelf says how many more, so it never grows without end. */
const MAX_WONDERS = 8;

/** How each group reads in a sentence. */
const GROUP_PHRASE: Record<TriageBucket, string> = {
  do: "things to do",
  later: "for later",
  drop: "let go",
  wonder: "questions",
};

/** One finding: a small label, the sentence, and the picture that proves it. */
function Finding({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card
      padding="var(--nil-spacing-md)"
      className="flex min-w-0 flex-col content-start gap-3"
      style={{ backgroundColor: "var(--nil-color-bg)" }}
    >
      <span className="nil-label nil-label--accent">{label}</span>
      {children}
    </Card>
  );
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

function SectionTitle({ children }: { children: string }) {
  return (
    <Heading level={2} style={{ fontSize: "var(--nil-type-scale-base)" }}>
      {children}
    </Heading>
  );
}
