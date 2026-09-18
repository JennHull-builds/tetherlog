import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ChipTone =
  | "now"
  | "later"
  | "wonder"
  | "do"
  | "drop"
  | "neutral";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  tone?: ChipTone;
  children: ReactNode;
}

const TONE_COLOR: Record<ChipTone, string> = {
  now: "var(--color-tag-now)",
  later: "var(--color-tag-later)",
  wonder: "var(--color-tag-wonder)",
  do: "var(--color-do)",
  drop: "var(--color-drop)",
  neutral: "var(--tl-mark)",
};

const badgeShell: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--tl-space-xs)",
  padding: "var(--tl-space-xs) var(--tl-space-sm)",
  // Body face, sentence case, no tracking: a chip is a choice a person makes,
  // not machine output. Mono is reserved for the parked count and the
  // navigation, and nothing else. See docs/LOOK.md.
  fontFamily: "var(--tl-font-body)",
  fontSize: "var(--tl-text-small)",
  borderRadius: "var(--tl-radius-full)",
};

/** NIL DS Badge pattern + TetherLog bucket tones. */
export function Chip({
  selected = false,
  tone = "neutral",
  className = "",
  type = "button",
  style,
  children,
  ...rest
}: ChipProps) {
  const color = TONE_COLOR[tone];

  return (
    <button
      type={type}
      className={className}
      style={{
        padding: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          ...badgeShell,
          border: `var(--tl-border-width) solid ${selected ? color : "var(--tl-rule)"}`,
          // A selected chip is a bucket-coloured fill, so the label must be
          // the GROUND colour, not ink. Ink on these hues measures 1.52:1 to
          // 1.85:1; ground on them measures 5.11:1 to 11.92:1.
          color: selected ? "var(--tl-on-mark)" : "var(--tl-ink-muted)",
          background: selected ? color : "transparent",
        }}
      >
        {children}
      </span>
    </button>
  );
}
