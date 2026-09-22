import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../components/ui";
import { db, getSettings } from "../db";
import { aiWeeklyDigest, buildWeeklyStats } from "../lib/agent";
import { copyText, downloadFile, shareText } from "../lib/hands";
import type { Capture } from "../types";

/**
 * Patterns.
 *
 * THE NUMBER SITS IN THE PAGE. No cards, no borders, no wells drawn around the
 * readouts: a numeral in the display face on the bare ground is the whole
 * treatment, and space is what separates one from the next. The ruled ground
 * the old blueprint called for came from the rejected Monolith direction, and
 * the only rule-weight token that would not be a visible boundary is the
 * hairline, which measures 1.08:1 and cannot be seen at all.
 *
 * NO COLOUR ON THIS SCREEN, and that is not an omission. docs/LOOK.md gives
 * the one colour per screen to the primary action, and a screen you arrive at
 * to read has none. The bars are ink, because data is not decoration, and the
 * digest control is a ghost for the same reason it is on Review: it is the one
 * action here that leaves the device.
 *
 * WHAT MAY BE SHOWN is fixed by CLAUDE.md product rule 2 and it is a product rule
 * rather than a layout one. No dial, no gauge, no target, no change arrow, no
 * day-over-day comparison, and `perDay` is never drawn as a sequence. A row of
 * daily bars with gaps in it is a streak display whatever the heading says.
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

  const digestMarkdown = `# Weekly digest\n\n${digest ?? "Run digest with your Gemini key in Settings."}\n\n## Stats\n- Total captures: ${stats.totalCaptures}\n- Active days: ${stats.activeDays}\n- Busiest hour: ${busiestHour}\n- Stuck items: ${stats.stuckCount}`;

  return (
    <section
      className="space-y-12"
      style={{
        paddingInline: "var(--tl-gutter)",
        paddingBlock: "var(--tl-space-lg)",
      }}
    >
      <h1 className="text-display font-light leading-display tracking-display text-ink">
        What keeps showing up
      </h1>

      {stats.totalCaptures === 0 ? (
        <p className="text-body text-muted">Nothing to see yet.</p>
      ) : (
        <>
          {/*
            TWO BY TWO AT EVERY WIDTH. The build spec asked for a row of
            four at 1280 and that blueprint assumed a full-width page. Every
            screen here is a 32rem column, so a row of four gives each readout
            about 104px, which wraps "TOTAL CAPTURES" onto a second line while
            its neighbours stay on one and leaves the row ragged. Review's
            summary uses the same grid, because the two screens now answer
            "how many" in the same voice. See docs/DECISIONS.md D-021.
          */}
          <section className="grid grid-cols-2 gap-x-6 gap-y-9">
            <Readout label="Total captures" value={String(stats.totalCaptures)} />
            <Readout label="Active days" value={String(stats.activeDays)} />
            <Readout label="Busiest hour" value={busiestHour} />
            <Readout label="Stuck items" value={String(stats.stuckCount)} />
          </section>

          <section className="space-y-4">
            <h2 className="text-body font-medium text-ink">Time of day</h2>
            <HourDistribution heatmap={stats.heatmap} max={maxHeat} />
          </section>

          {stats.topRepeats.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-body font-medium text-ink">Repeats</h2>
              <ul className="space-y-2">
                {stats.topRepeats.map((item) => (
                  <li
                    key={item.text}
                    className="flex items-baseline justify-between gap-4 text-body text-ink"
                  >
                    <span className="min-w-0 truncate">{item.text}</span>
                    <span className="shrink-0 font-mono text-micro tracking-micro text-muted">
                      &times;{item.count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body font-medium text-ink">Weekly digest</h2>
          <Button
            variant="ghost"
            className="py-1"
            onClick={() => void runDigest()}
            disabled={!hasKey || loading}
          >
            {loading ? "Writing…" : "Generate"}
          </Button>
        </div>
        {!hasKey && (
          <p className="text-small text-muted">
            Add Gemini key in Settings for narrative digest. Stats above always work.
          </p>
        )}
        {digest && <p className="text-body text-ink">{digest}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="py-2" onClick={() => void copyText(digestMarkdown)}>
            Copy digest
          </Button>
          <Button
            variant="ghost"
            className="py-2"
            onClick={() => downloadFile("weekly-digest.md", digestMarkdown, "text/markdown")}
          >
            Download markdown
          </Button>
          <Button
            variant="ghost"
            className="py-2"
            onClick={() => void shareText("Weekly digest", digest ?? digestMarkdown)}
          >
            Share
          </Button>
        </div>
      </section>
    </section>
  );
}

/**
 * A number in the page. The label is the only mono on this screen besides the
 * repeat counts, which is the role docs/LOOK.md reserves it for.
 */
function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-display font-light leading-display tracking-display tabular-nums text-ink">
        {value}
      </p>
      <p className="font-mono text-micro uppercase tracking-micro text-muted">{label}</p>
    </div>
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
 * now draws at least a 2px mark on the baseline, in the structural rule token
 * at 3.22:1, so "nothing happened here" is something you can actually see.
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
              height: count ? `max(2px, ${(count / max) * 100}%)` : "2px",
              background: count ? "var(--tl-ink-muted)" : "var(--tl-rule)",
              borderRadius: "var(--tl-radius-sm)",
              // Staggered by 8ms, so the row reads left to right once and then
              // is still. The only decorative motion in the app, and it is
              // defensible because this is a screen you arrive at to read.
              animationDelay: `${hour * 8}ms`,
            }}
          />
        ))}
      </div>
      <div
        className="grid gap-px font-mono text-micro tracking-micro text-muted"
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
