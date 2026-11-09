import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useFlip } from "../../lib/flip";
import { prefersReducedMotion, readDurationMs } from "../../lib/motion";
import type { Capture } from "../../types";

export interface PeekStackProps {
  /** Today's captures, newest first. */
  captures: Capture[];
  /** The count line, so Capture's grid can keep clear of it. */
  countRef?: RefObject<HTMLParagraphElement | null>;
  /**
   * When this screen opened, in ms. A capture made after it is a thought that
   * has just been parked, and it lands: the count ticks up and its row enters
   * as the last letters finish sinking (D-040). Anything older was already
   * here, and is simply shown.
   */
  since?: number;
}

/**
 * What is already in the well, receding below the box.
 *
 * This is the fourth moment: "the log below is one row longer". It is evidence
 * that letting go was safe, which is the one thing that makes letting go
 * possible. It is NOT a list to read: Review is where things get read, and
 * nothing here rewards coming back to look.
 *
 * DEPTH WITHOUT A SHADOW, drawn in nil-ds tokens since D-030. Three cues, no
 * box-shadow anywhere:
 *
 *   1. Occlusion. Each row sits partly behind the one above it.
 *   2. Width. Each row is narrower, so it reads as farther away.
 *   3. Value. The ink steps from --nil-color-text to --nil-color-text-muted.
 *
 * TWO ROWS, AND NO MORE. The count says there are more than two, and that is
 * the cue.
 */

const ROW_INK = ["var(--nil-color-text)", "var(--nil-color-text-muted)"];
const ROW_SURFACE = ["var(--nil-color-surface)", "var(--nil-color-bg)"];
const ROW_WIDTH = ["100%", "92%"];

/** The rows that count as already here: made before the screen opened. */
function sameIds(a: Capture[], b: Capture[]): boolean {
  return a.length === b.length && a.every((capture, i) => capture.id === b[i].id);
}

/**
 * The count, as a numeral that rolls: the old one lifts out and fades while the
 * new one rises in from below, once, on the kit's base duration. Under reduced
 * motion the new numeral is simply there.
 */
function Tick({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [out, setOut] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (value === shown) return;
    const id = window.setTimeout(() => {
      if (!prefersReducedMotion() && value > shown) {
        setOut(shown);
        setArmed(true);
      }
      setShown(value);
    }, 0);
    return () => window.clearTimeout(id);
  }, [value, shown]);

  return (
    <span className="tl-tick">
      {out !== null && (
        <span
          key={`out-${out}`}
          aria-hidden
          className="tl-tick-out"
          onAnimationEnd={() => setOut(null)}
        >
          {out}
        </span>
      )}
      <span key={shown} className={armed ? "tl-tick-in" : undefined}>
        {shown}
      </span>
    </span>
  );
}

export function PeekStack({ captures, countRef, since = 0 }: PeekStackProps) {
  // What is on screen trails what is parked by the length of the sink, so the
  // thought lands as its letters finish rather than before they have gone.
  // The count, the new row and the older row's move all happen at that one
  // moment, because they all read from this list.
  const [landed, setLanded] = useState(() =>
    captures.filter((capture) => capture.createdAt < since),
  );

  useEffect(() => {
    if (sameIds(captures, landed)) return;
    const arriving = captures.some(
      (capture) =>
        capture.createdAt >= since &&
        !landed.some((shown) => shown.id === capture.id),
    );
    const wait =
      arriving && !prefersReducedMotion()
        ? readDurationMs("--nil-motion-duration-base", 200)
        : 0;
    const id = window.setTimeout(() => setLanded(captures), wait);
    return () => window.clearTimeout(id);
  }, [captures, landed, since]);

  const count = landed.length;
  const rows = landed.slice(0, 2);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  useFlip(rowsRef, rows.map((capture) => capture.id).join());

  if (count === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3 lg:items-start">
      <p
        ref={countRef}
        className="nil-label nil-label--accent"
        aria-live="off"
      >
        <Tick value={count} /> parked today
      </p>

      <div ref={rowsRef} className="flex w-full flex-col items-center">
        {rows.map((capture, i) => {
          const style: CSSProperties = {
            width: ROW_WIDTH[i],
            background: ROW_SURFACE[i],
            color: ROW_INK[i],
            border: "var(--nil-border-width) solid var(--nil-color-text-muted)",
            borderRadius: "var(--nil-radius-default)",
            padding: "var(--nil-spacing-sm) var(--nil-spacing-md)",
            fontFamily: "var(--nil-font-mono)",
            fontSize: "var(--nil-type-scale-sm)",
            lineHeight: 1.5,
            // Occlusion: the row below starts under the row above it.
            marginTop: i === 0 ? 0 : "calc(var(--nil-spacing-sm) * -1)",
            // Stacking order is the depth order, so row 0 is genuinely in front.
            zIndex: rows.length - i,
            position: "relative",
          };

          return (
            <div
              // Keyed by capture id, so the arrival animation runs on a NEW
              // element every time and can never queue behind the last one.
              key={capture.id}
              data-flip-key={capture.id}
              style={style}
              // A thought parked since the screen opened lands a beat after the
              // older row starts moving down, so the two never overlap.
              className={
                capture.createdAt >= since
                  ? "tl-parked-row tl-parked-row-landing truncate"
                  : "tl-parked-row truncate"
              }
            >
              {capture.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
