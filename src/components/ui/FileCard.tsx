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
  neutral: "var(--tl-rule)",
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
    background: "var(--tl-raised)",
    border: "var(--tl-border-width) solid var(--tl-rule)",
    borderRadius: "var(--tl-radius)",
    padding: peek ? (compact ? "var(--tl-space-sm)" : "var(--tl-space-md)") : "var(--tl-space-md)",
    paddingLeft: "calc(var(--tl-space-md) + 6px)",
    minHeight: peek ? (compact ? "2.25rem" : "4rem") : undefined,
    boxShadow: peek ? "3px 3px 0 var(--tl-rule)" : undefined,
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
          fontFamily: "var(--tl-font-mono)",
          fontSize: "var(--tl-text-small)",
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
