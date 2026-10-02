import type { CSSProperties, ReactNode } from "react";

export interface TriageCardProps {
  /** The suggested bucket, in words. Words are the only carrier: D-028. */
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
 * ONE thought, on top of the deck. The unit of the triage ritual.
 *
 * NO COLOUR. The bucket is written in words and nothing else: there is no
 * secondary palette in this app. It used to carry a 4px bar in the bucket's
 * hue on its leading edge, which was never an approved colour. See
 * docs/DECISIONS.md D-028.
 *
 * AN EDGE, NOT A SHADOW. The card is --tl-field with the structural rule as its
 * edge, the same edge the capture field rests on, so the cards under it in the
 * deck can be seen as cards at all: surface steps on this ground measure 1.10:1
 * to 1.24:1, which is invisible. No box-shadow, ever.
 *
 * THE FOOTER IS PINNED. The card is a fixed height whatever is in it, so
 * Confirm is in the same place on card one and card seven. Triage is the one
 * repetitive action in the app and a target that moves between repetitions is
 * a target you have to find again every time.
 */
export function TriageCard({
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
        border: "var(--tl-border-width) solid var(--tl-rule)",
        borderRadius: "var(--tl-radius-lg)",
        padding: "var(--tl-space-lg)",
        ...style,
      }}
    >
      <header className="flex items-baseline justify-between gap-3">
        <p id={`${domId}-label`} className="text-small font-medium text-ink">
          {label}
        </p>
        <p className="font-mono text-micro tracking-micro text-muted">{time}</p>
      </header>

      {/*
        THE THOUGHT SITS IN THE MIDDLE OF THE CARD, not at the top of it. A
        short thought otherwise leaves a hole between the last line and the
        footer, which reads as an unfinished card. Centred, the same space is
        above and below it and the card reads as one object.

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

export interface TriageDeckProps {
  /** How many cards wait under this one: 0, 1, or 2 and more. */
  under: number;
}

/**
 * The cards still waiting, as the edges of a deck under the one on top.
 *
 * At most two edges, because a third is not more information: the count above
 * the card says how many there are. Each sits a step lower and a step narrower
 * than the one above it, and is occluded by it, so only its bottom edge shows.
 * Same edge token as the card, so a stack reads as a stack: a surface step on
 * this ground alone is invisible, which is why the old peek had to carry the
 * next thought's words to be seen at all. See docs/DECISIONS.md D-028.
 *
 * Rendered before the card, inside the same box, and never animated: the card
 * on top is what moves. Deepest layer first, so the nearer one paints over it.
 */
export function TriageDeck({ under }: TriageDeckProps) {
  const layers = Math.min(Math.max(under, 0), 2);
  return (
    <>
      {Array.from({ length: layers }, (_, i) => {
        const step = layers - i;
        return (
          <div
            key={step}
            aria-hidden
            style={{
              // Shifted down a step and in a step per layer. No z-index: these
              // render before the card, which sits above them on z-10. A
              // negative one would paint behind an ancestor's background.
              position: "absolute",
              top: `calc(var(--tl-space-sm) * ${step})`,
              bottom: `calc(var(--tl-space-sm) * ${-step})`,
              left: `calc(var(--tl-space-md) * ${step})`,
              right: `calc(var(--tl-space-md) * ${step})`,
              background: step === 1 ? "var(--tl-raised)" : "var(--tl-ground)",
              border: "var(--tl-border-width) solid var(--tl-rule)",
              borderRadius: "var(--tl-radius-lg)",
            }}
          />
        );
      })}
    </>
  );
}
