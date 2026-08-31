import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import type { ChipTone } from "./Chip";

export type FileTone = ChipTone;

export interface FileCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: FileTone;
  children?: ReactNode;
  peek?: boolean;
  compact?: boolean;
}

const TONE_BAR: Record<FileTone, string> = {
  now: "var(--color-tag-now)",
  later: "var(--color-tag-later)",
  wonder: "var(--color-tag-wonder)",
  do: "var(--color-do)",
  drop: "var(--color-drop)",
  neutral: "var(--nil-color-border)",
};

/**
 * Brutalist bracket stack — hard borders, 0 radius, left accent bar.
 * Replaces the old filed-tab warm-paper silhouette.
 */
export function FileCard({
  tone = "neutral",
  peek = false,
  compact = false,
  children,
  className = "",
  style,
  ...rest
}: FileCardProps) {
  const barColor = TONE_BAR[tone];
  const shellStyle: CSSProperties = {
    position: "relative",
    background: "var(--nil-color-surface)",
    border: "var(--nil-border-width) solid var(--nil-color-border)",
    borderRadius: "var(--nil-radius-none)",
    padding: peek ? (compact ? "var(--nil-spacing-sm)" : "var(--nil-spacing-md)") : "var(--nil-spacing-md)",
    paddingLeft: "calc(var(--nil-spacing-md) + 6px)",
    minHeight: peek ? (compact ? "2.25rem" : "4rem") : undefined,
    boxShadow: peek ? "3px 3px 0 var(--nil-color-border)" : undefined,
    ...style,
  };

  return (
    <div className={className} style={shellStyle} {...rest}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "6px",
          background: barColor,
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "6px",
          top: 0,
          fontFamily: "var(--nil-font-mono)",
          fontSize: "var(--nil-type-scale-xs)",
          color: barColor,
          lineHeight: 1,
          padding: "2px 4px",
        }}
      >
        [
      </span>
      {!peek ? children : null}
    </div>
  );
}
