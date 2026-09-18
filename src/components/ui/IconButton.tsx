import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type IconButtonTone = "quiet" | "primary";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /**
   * Read out, never drawn. Phase 4 turned Mic and Park into glyphs, so the
   * words that used to be on them live here: nothing is lost to a screen
   * reader, and the copy work still has the strings to inherit.
   */
  label: string;
  tone?: IconButtonTone;
  /**
   * A primary control is a ring when there is nothing to do with it and a
   * filled disc when there is. The ring says "here"; the fill says "now".
   * That way the one colour per screen is present in every state, on the same
   * element, rather than blinking into existence when you start typing.
   */
  armed?: boolean;
  children: ReactNode;
}

/** 44px. Below that it is not a tap target on a phone, whatever it looks like. */
const SIZE = 44;

const BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  width: SIZE,
  height: SIZE,
  padding: 0,
  borderRadius: "var(--tl-radius-full)",
  background: "transparent",
  borderStyle: "solid",
  borderWidth: "var(--tl-border-width)",
  borderColor: "transparent",
  cursor: "pointer",
};

export function IconButton({
  label,
  tone = "quiet",
  armed = false,
  disabled,
  style,
  className = "",
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  const primary = tone === "primary";

  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark-high ${className}`}
      style={{
        ...BASE,
        color: primary
          ? armed
            ? "var(--tl-on-mark)"
            : "var(--tl-mark-high)"
          : "var(--tl-ink-muted)",
        background: primary && armed ? "var(--tl-mark)" : "transparent",
        borderColor: primary && !armed ? "var(--tl-mark-high)" : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        transitionDuration: "var(--tl-spring-dismiss-duration)",
        transitionTimingFunction: "var(--tl-ease-standard)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const GLYPH = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function MicGlyph() {
  return (
    <svg {...GLYPH} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/**
 * Down, to a line. Not a send arrow: nothing is being transmitted, and the
 * stack the thought lands in is directly below the field.
 */
export function ParkGlyph() {
  return (
    <svg {...GLYPH} aria-hidden>
      <path d="M12 4v10" />
      <path d="M7.8 9.8 12 14l4.2-4.2" />
      <path d="M5.5 19h13" />
    </svg>
  );
}

export function StopGlyph() {
  return (
    <svg {...GLYPH} aria-hidden>
      <rect
        x="7.5"
        y="7.5"
        width="9"
        height="9"
        rx="2.5"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
