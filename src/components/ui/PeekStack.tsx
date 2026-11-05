import type { CSSProperties, RefObject } from "react";
import type { Capture } from "../../types";

export interface PeekStackProps {
  /** Today's captures, newest first. */
  captures: Capture[];
  /** The count line, so Capture's grid can keep clear of it. */
  countRef?: RefObject<HTMLParagraphElement | null>;
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

export function PeekStack({ captures, countRef }: PeekStackProps) {
  const count = captures.length;
  const rows = captures.slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-3">
      <p
        ref={countRef}
        className="nil-label"
        aria-live="off"
      >
        {count === 1 ? "1 parked today" : `${count} parked today`}
      </p>

      <div className="flex w-full flex-col items-center">
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
              style={style}
              className="tl-parked-row truncate"
            >
              {capture.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
