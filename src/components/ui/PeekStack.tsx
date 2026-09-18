import type { CSSProperties } from "react";
import type { Capture } from "../../types";

export interface PeekStackProps {
  /** Today's captures, newest first. */
  captures: Capture[];
}

/**
 * What is already in the well, receding below the field.
 *
 * This is the fourth moment: "the log below is one row longer". It is evidence
 * that letting go was safe, which is the one thing that makes letting go
 * possible. It is NOT a list to read: Review is where things get read, and
 * nothing here rewards coming back to look.
 *
 * DEPTH WITHOUT A SHADOW. Three cues, no box-shadow anywhere:
 *
 *   1. Occlusion. Each row sits partly behind the one above it.
 *   2. Width. Each row is narrower, so it reads as farther away.
 *   3. Value. The surface steps toward the ground and the ink steps down the
 *      scale, from --tl-ink to --tl-ink-muted.
 *
 * TWO ROWS, AND NO MORE. A third would have to use --tl-ink-faint, which is
 * non-text by policy, or drop the opacity, which measured 3.17:1 and fails AA.
 *
 * A blank third sliver was tried as the "there are more below" cue and is
 * deliberately gone: any surface token on this ground measures 1.10:1 to
 * 1.24:1, so a textless bar is not faint, it is invisible. Rendering something
 * nobody can see is worse than rendering nothing, because it reads as done.
 * The count says there are three while showing two, and that is the cue.
 */

const ROW_INK = ["var(--tl-ink)", "var(--tl-ink-muted)"];
const ROW_SURFACE = ["var(--tl-field)", "var(--tl-raised)"];
const ROW_WIDTH = ["100%", "92%"];

export function PeekStack({ captures }: PeekStackProps) {
  const count = captures.length;
  const rows = captures.slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-3">
      <p
        className="font-mono text-micro tracking-micro text-muted"
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
            borderRadius: "var(--tl-radius)",
            padding: "var(--tl-space-sm) var(--tl-space-md)",
            fontSize: "var(--tl-text-body)",
            lineHeight: "var(--tl-leading-body)",
            // Occlusion: the row below starts under the row above it.
            marginTop: i === 0 ? 0 : "calc(var(--tl-space-sm) * -1)",
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
