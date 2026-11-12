import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { TriageBucket } from "../types";
import type { Group, LoopStatus, MixFinding, WhenFinding } from "../lib/patterns";
import { WEEKDAY_NAMES, dayLabel, slotWords, spokenHour } from "../lib/patterns";

/**
 * The small pictures on Patterns (D-043). Plain SVG with a viewBox, so each one
 * scales to its container and never scrolls sideways. Every colour is a kit
 * token, every mark is outlined in the kit's border colour, and every chart is
 * role="img" with a label that says what it shows, because the sentence above
 * it carries the meaning and a chart should never be the only way to get it.
 *
 * The outline is drawn with a non-scaling stroke, so it stays the kit's border
 * width on screen however far the viewBox is scaled.
 */

const MARK: CSSProperties = {
  stroke: "var(--nil-color-border)",
  strokeWidth: "var(--nil-border-width)",
  vectorEffect: "non-scaling-stroke",
};

const HAIRLINE: CSSProperties = {
  stroke: "var(--nil-color-text-muted)",
  strokeOpacity: 0.4,
  strokeWidth: 1,
  vectorEffect: "non-scaling-stroke",
};

const AXIS_TEXT: CSSProperties = {
  fill: "var(--nil-color-text-muted)",
  fontFamily: "var(--nil-font-mono)",
};

/** Chart text is this many CSS px at every width, however far the chart scales. */
const AXIS_PX = 12;

/** How many CSS px one viewBox unit is on screen, so text can stay one size while the chart scales. */
function useUnit(viewBoxWidth: number): [RefObject<SVGSVGElement | null>, number] {
  const ref = useRef<SVGSVGElement | null>(null);
  const [unit, setUnit] = useState(1);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const measure = () => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0) setUnit(w / viewBoxWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [viewBoxWidth]);
  return [ref, unit];
}

const SVG_STYLE: CSSProperties = { display: "block", width: "100%", height: "auto" };

/** The group colours (D-041). Untriaged is a neutral surface with the same outline. */
const GROUP_FILL: Record<Group, string> = {
  do: "var(--nil-color-chart-blue)",
  later: "var(--nil-color-chart-orange-pale)",
  drop: "var(--nil-color-chart-orange)",
  wonder: "var(--nil-color-chart-blue-pale)",
  none: "var(--nil-color-surface)",
};

/** The kit's five-step chart ramp, pale to full. A count lands on the step its share of the busiest cell reaches. */
function rampColour(count: number, max: number): string {
  const step = Math.min(5, Math.max(1, Math.ceil((count / max) * 5)));
  return `var(--nil-color-chart-ramp-${step})`;
}

// ---- when: hour by weekday ---------------------------------------------------

const HEAT_W = 300;
const HEAT_LABEL_W = 32;
const HEAT_ROW_H = 17;

export function HeatmapChart({ when }: { when: WhenFinding }) {
  const { grid, firstHour, lastHour, max } = when;
  const cols = lastHour - firstHour + 1;
  const cell = (HEAT_W - HEAT_LABEL_W) / cols;
  const ticks: number[] = [];
  for (let h = Math.ceil(firstHour / 3) * 3; h <= lastHour; h += 3) ticks.push(h);
  const [svgRef, unit] = useUnit(HEAT_W);
  const axis: CSSProperties = { ...AXIS_TEXT, fontSize: AXIS_PX / unit };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${HEAT_W} ${7 * HEAT_ROW_H + 20}`}
      role="img"
      aria-label={`Thoughts by weekday and hour, from ${spokenHour(firstHour)}:00 to the end of the day. Darker blue is more thoughts. The busiest two hours are ${WEEKDAY_NAMES[when.weekday]} between ${slotWords(when.hour)}, with ${when.count}.`}
      style={SVG_STYLE}
    >
      {grid.map((row, r) => (
        <g key={WEEKDAY_NAMES[r]}>
          <text x={0} y={r * HEAT_ROW_H + 12} style={axis}>
            {WEEKDAY_NAMES[r].slice(0, 3)}
          </text>
          {row.slice(firstHour, lastHour + 1).map((value, i) => (
            <rect
              key={firstHour + i}
              x={HEAT_LABEL_W + i * cell}
              y={r * HEAT_ROW_H}
              width={cell - 2}
              height={HEAT_ROW_H - 2}
              style={
                value > 0
                  ? { ...MARK, fill: rampColour(value, max) }
                  : { ...HAIRLINE, fill: "none" }
              }
            />
          ))}
        </g>
      ))}
      {ticks.map((h) => (
        <text
          key={h}
          x={HEAT_LABEL_W + (h - firstHour) * cell}
          y={7 * HEAT_ROW_H + 14}
          style={axis}
        >
          {String(h).padStart(2, "0")}
        </text>
      ))}
    </svg>
  );
}

// ---- days it came back --------------------------------------------------------

const STRIP_W = 168;
const STRIP_H = 16;

/**
 * One block per day it came back. Blue marks the day it got done, orange the day
 * it was let go. Given `days`, it is the taller version with dates underneath.
 */
export function DayStrip({
  length,
  dayIndexes,
  status = "still",
  endIndex = null,
  label,
  days,
}: {
  length: number;
  dayIndexes: number[];
  status?: LoopStatus;
  endIndex?: number | null;
  label: string;
  days?: string[];
}) {
  // The tall version is drawn on the same 300-wide canvas as the other charts,
  // so its dates and blocks come out at the same size as theirs.
  const width = days ? 300 : STRIP_W;
  const pitch = width / Math.max(length, 1);
  const block = days ? Math.min(12, Math.max(4, pitch - 2)) : Math.min(8, Math.max(3, pitch - 1.5));
  const barH = days ? 24 : STRIP_H - 4;
  const height = days ? barH + 22 : STRIP_H;
  const every = length > 21 ? 7 : length > 10 ? 5 : 1;
  const [svgRef, unit] = useUnit(width);
  const axis: CSSProperties = { ...AXIS_TEXT, fontSize: AXIS_PX / unit };
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      style={SVG_STYLE}
    >
      <line
        x1={0}
        x2={width}
        y1={days ? barH / 2 + 2 : STRIP_H / 2}
        y2={days ? barH / 2 + 2 : STRIP_H / 2}
        style={HAIRLINE}
      />
      {dayIndexes.map((index) => {
        const ended = index === endIndex && status !== "still";
        const fill = !ended
          ? "var(--nil-color-chart-orange-pale)"
          : status === "done"
            ? "var(--nil-color-chart-blue)"
            : "var(--nil-color-chart-orange)";
        return (
          <rect
            key={index}
            x={index * pitch + (pitch - block) / 2}
            y={2}
            width={block}
            height={barH}
            style={{ ...MARK, fill }}
          />
        );
      })}
      {days &&
        days.map((key, i) =>
          i % every === 0 && i < length - 2 ? (
            <text key={key} x={i * pitch} y={barH + 17} style={axis}>
              {dayLabel(key)}
            </text>
          ) : null,
        )}
    </svg>
  );
}

// ---- where they went: one bar for the whole window --------------------------

const MIX_W = 300;
const MIX_H = 34;
const STACK_ORDER: Group[] = ["do", "later", "drop", "wonder", "none"];
const GROUP_WORDS: Record<Group, string> = {
  do: "Do",
  later: "Later",
  drop: "Drop",
  wonder: "Wonder",
  none: "Not sorted yet",
};

/** One stacked bar. A count sits on a segment only where it fits; the key below always carries it. */
export function MixChart({ finding }: { finding: MixFinding }) {
  const { counts, total } = finding;
  const present = STACK_ORDER.filter((g) => counts[g] > 0);
  const parts = present.map((g, i) => ({
    g,
    x: present.slice(0, i).reduce((sum, h) => sum + counts[h], 0) * (MIX_W / total),
    w: counts[g] * (MIX_W / total),
  }));
  const summary = STACK_ORDER.filter((g) => counts[g] > 0)
    .map((g) => `${GROUP_WORDS[g]} ${counts[g]}`)
    .join(", ");
  const [svgRef, unit] = useUnit(MIX_W);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${MIX_W} ${MIX_H}`}
      role="img"
      aria-label={`Where the ${total} thoughts went: ${summary}.`}
      style={SVG_STYLE}
    >
      {parts.map(({ g, x: px, w }) => (
        <g key={g}>
          <rect
            x={px}
            y={1}
            width={w}
            height={MIX_H - 2}
            style={{ ...MARK, fill: GROUP_FILL[g] }}
          />
          {w >= 24 && (
            <text
              x={px + w / 2}
              y={MIX_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                ...AXIS_TEXT,
                fontSize: AXIS_PX / unit,
                fill: g === "none" ? "var(--nil-color-text)" : `var(--nil-color-chart-${GROUP_TEXT[g]}-text)`,
              }}
            >
              {counts[g]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const GROUP_TEXT: Record<TriageBucket, string> = {
  do: "blue",
  later: "orange-pale",
  drop: "orange",
  wonder: "blue-pale",
};

/** The key to the group colours, with each count. The name is on every swatch, so colour is never the only carrier. */
export function GroupLegend({ counts }: { counts: Record<Group, number> }) {
  const items = STACK_ORDER.filter((g) => g !== "none" || counts.none > 0);
  return (
    <ul className="nil-label m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0" aria-label="Colour key">
      {items.map((g) => (
        <li key={g} className="flex items-center gap-1.5">
          <span
            aria-hidden
            style={{
              display: "block",
              width: 10,
              height: 10,
              background: GROUP_FILL[g],
              border: "var(--nil-border-width) solid var(--nil-color-border)",
            }}
          />
          {`${GROUP_WORDS[g]} ${counts[g]}`}
        </li>
      ))}
    </ul>
  );
}
