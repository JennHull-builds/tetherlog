import type { CSSProperties, ReactNode } from "react";

export type BucketTone = "do" | "later" | "drop" | "wonder";

const TONE: Record<BucketTone, string> = {
  do: "var(--color-do)",
  later: "var(--color-tag-later)",
  drop: "var(--color-drop)",
  wonder: "var(--color-tag-wonder)",
};

export interface TriageCardProps {
  /** Which bucket is being suggested. Drives the leading-edge bar only. */
  tone: BucketTone;
  /** The bucket in words. The bar is the marker; this is the carrier. */
  label: string;
  /** When the thought was parked. Mono, because it is machine output. */
  time: string;
  /** Stable id prefix, so the thought can name the card for a screen reader. */
  domId: string;
  /** The thought, the reason, and anything else about this one capture. */
  children: ReactNode;
  /** Confirm, then the overrides. Pinned to the bottom on every card. */
  footer?: ReactNode;
  cardRef?: React.Ref<HTMLElement>;
  className?: string;
  style?: CSSProperties;
}

/**
 * ONE thought, filling the view. The unit of the triage ritual.
 *
 * COLOUR IS NEVER THE CARRIER. The bucket hue exists once, as a 4px bar on the
 * leading edge, and the same bucket is written in words beside it. Read the
 * card in greyscale and nothing is missing. See docs/DECISIONS.md D-017.
 *
 * DEPTH IS VALUE, NOT A SHADOW. The card is --tl-field, the nearest surface in
 * the system, sitting on the ground with the next thought's peek one step back
 * on --tl-raised behind it. No border, no box-shadow: an edge attached to the
 * object is the neumorphic move docs/LOOK.md rejects.
 *
 * THE FOOTER IS PINNED. The card is a fixed height whatever is in it, so
 * Confirm is in the same place on card one and card seven. Triage is the one
 * repetitive action in the app and a target that moves between repetitions is
 * a target you have to find again every time.
 */
export function TriageCard({
  tone,
  label,
  time,
  domId,
  children,
  footer,
  cardRef,
  className = "",
  style,
}: TriageCardProps) {
  return (
    <article
      ref={cardRef}
      tabIndex={-1}
      aria-labelledby={`${domId}-label ${domId}-text`}
      className={`flex h-full flex-col overflow-hidden outline-none ${className}`}
      style={{
        position: "relative",
        background: "var(--tl-field)",
        borderRadius: "var(--tl-radius-lg)",
        padding: "var(--tl-space-lg)",
        paddingLeft: "calc(var(--tl-space-lg) + 4px)",
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "4px",
          background: TONE[tone],
        }}
      />

      <header className="flex items-baseline justify-between gap-3">
        <p id={`${domId}-label`} className="text-small font-medium text-ink">
          {label}
        </p>
        <p className="font-mono text-micro tracking-micro text-muted">{time}</p>
      </header>

      {/*
        THE THOUGHT SITS IN THE MIDDLE OF THE CARD, not at the top of it. A
        short thought in a card that fills the view otherwise leaves a hole
        between the last line and the footer, which reads as an unfinished
        card rather than as the air docs/LOOK.md asks for. Centred, the same
        emptiness is above and below it and the card reads as one object.

        The footer does not move with it. The thought is content and may sit a
        few pixels differently from card to card; Confirm is a target and may
        not.
      */}
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-5">
        <div>{children}</div>
      </div>

      {footer ? <div className="shrink-0">{footer}</div> : null}
    </article>
  );
}

export interface TriagePeekProps {
  /** The next thought's own words. Never an empty bar. */
  text: string;
}

/**
 * The next thought, at the fold.
 *
 * Same three depth cues as the capture peek stack and no fourth: occlusion (it
 * starts under the card), width (it is narrower) and value (--tl-raised is one
 * step back from --tl-field, and the ink steps down to --tl-ink-muted).
 *
 * It carries the next thought's actual words. A textless sliver was tried on
 * Capture as the "there is more below" cue and every surface token measures
 * 1.10:1 to 1.24:1 on this ground, so it was not faint, it was invisible.
 * See docs/DECISIONS.md D-014.
 */
export function TriagePeek({ text }: TriagePeekProps) {
  return (
    <div
      aria-hidden
      className="truncate text-body text-muted"
      style={{
        width: "92%",
        // Occlusion: it starts under the card above it, which is what makes it
        // read as behind rather than merely below.
        margin: "calc(var(--tl-space-sm) * -1) auto 0",
        background: "var(--tl-raised)",
        borderRadius: "var(--tl-radius)",
        padding: "var(--tl-space-sm) var(--tl-space-md)",
      }}
    >
      {text}
    </div>
  );
}
