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
  neutral: "var(--nil-color-accent)",
};

const badgeShell: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--nil-spacing-xs)",
  padding: "var(--nil-spacing-xs) var(--nil-spacing-sm)",
  fontFamily: "var(--nil-font-mono)",
  fontSize: "var(--nil-type-scale-xs)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  borderRadius: "var(--nil-radius-none)",
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
          border: `var(--nil-border-width) solid ${selected ? color : "var(--nil-color-text-muted)"}`,
          color: selected ? "var(--nil-color-text)" : "var(--nil-color-text-muted)",
          background: selected ? color : "transparent",
        }}
      >
        {children}
      </span>
    </button>
  );
}
