import type { HTMLAttributes, ReactNode } from "react";
import type { ChipTone } from "./Chip";

export type FileTone = ChipTone;

export interface FileCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: FileTone;
  children?: ReactNode;
  peek?: boolean;
}

const TAB_CLASS: Record<FileTone, string> = {
  now: "bg-tag-now",
  later: "bg-tag-later",
  wonder: "bg-tag-wonder",
  do: "bg-do",
  drop: "bg-drop",
  neutral: "bg-line",
};

export function FileCard({
  tone = "neutral",
  peek = false,
  children,
  className = "",
  ...rest
}: FileCardProps) {
  return (
    <div className={`relative ${className}`} {...rest}>
      <span
        aria-hidden
        className={`absolute left-3 top-0 z-10 h-3 w-11 ${TAB_CLASS[tone]}`}
        style={{
          clipPath: "polygon(8% 100%, 14% 12%, 86% 12%, 92% 100%)",
        }}
      />
      <div
        className={`overflow-hidden rounded-xl border border-line bg-raised ${
          peek ? "min-h-16 pt-3" : "px-4 pb-4 pt-5"
        }`}
      >
        {peek ? null : children}
      </div>
    </div>
  );
}
