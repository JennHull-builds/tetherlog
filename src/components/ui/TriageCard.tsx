import type { CSSProperties, ReactNode } from "react";
import { Badge, Card } from "nil-ds";
import type { TriageBucket } from "../../types";
import { BucketMark } from "./BucketMark";

export interface TriageCardProps {
  /** The suggested bucket, in words. Words are the only carrier. */
  label: string;
  /** The suggested group, which sets the mark's fill (D-041). The words in `label` still name it. */
  bucket?: TriageBucket;
  /** The capture was tagged Today: a small badge says so (D-035). */
  today?: boolean;
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
 * ONE thought, on top of the deck. The unit of the triage ritual, drawn with
 * the kit's Card in the kit's dark theme (D-031).
 *
 * The article is the focus target and the accessible name, so a screen reader
 * hears the bucket and the thought before it is asked to agree. The Card inside
 * it is the visible surface.
 *
 * THE FOOTER IS PINNED. The card is a fixed height whatever is in it, so
 * Confirm is in the same place on card one and card seven. Triage is the one
 * repetitive action in the app and a target that moves between repetitions is
 * a target you have to find again every time.
 */
export function TriageCard({
  label,
  bucket,
  today = false,
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
      className={`h-full outline-none ${className}`}
      style={style}
    >
      <Card
        padding="var(--nil-spacing-md)"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <header className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            {bucket ? (
              <BucketMark bucket={bucket} id={`${domId}-label`}>
                {label}
              </BucketMark>
            ) : (
              <p id={`${domId}-label`} className="nil-label" style={{ color: "var(--nil-color-text)" }}>
                {label}
              </p>
            )}
            {today && <Badge tone="accent">Today</Badge>}
          </div>
          <p className="nil-label">{time}</p>
        </header>

        {/* The thought sits in the middle of the card, so a short one does not
            leave a hole above the footer. The footer does not move with it. */}
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-4">
          <div>{children}</div>
        </div>

        {footer ? <div className="shrink-0">{footer}</div> : null}
      </Card>
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
 * Rendered before the card and never animated. No z-index: the card sits above
 * on z-10, and a negative one would paint behind an ancestor's background.
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
              position: "absolute",
              top: `calc(var(--nil-spacing-sm) * ${step})`,
              bottom: `calc(var(--nil-spacing-sm) * ${-step})`,
              left: `calc(var(--nil-spacing-md) * ${step})`,
              right: `calc(var(--nil-spacing-md) * ${step})`,
              background: step === 1 ? "var(--nil-color-surface)" : "var(--nil-color-bg)",
              border: "var(--nil-border-width) solid var(--nil-color-border)",
              borderRadius: "var(--nil-radius-default)",
            }}
          />
        );
      })}
    </>
  );
}
