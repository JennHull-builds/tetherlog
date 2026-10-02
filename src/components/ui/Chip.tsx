import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: ReactNode;
}

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

/**
 * A choice a person makes. Monochrome on purpose: there is no secondary
 * palette, so a bucket is its word and nothing else (D-028). Selected is
 * carried by three things at once, none of them a hue: the edge and the label
 * step up to full ink, and the surface lifts one step off the ground.
 */
export function Chip({
  selected = false,
  className = "",
  type = "button",
  style,
  children,
  ...rest
}: ChipProps) {
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
          border: `var(--tl-border-width) solid ${selected ? "var(--tl-ink)" : "var(--tl-rule)"}`,
          color: selected ? "var(--tl-ink)" : "var(--tl-ink-muted)",
          background: selected ? "var(--tl-field-focus)" : "transparent",
        }}
      >
        {children}
      </span>
    </button>
  );
}
