import type { ButtonHTMLAttributes, ReactNode } from "react";

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

const SELECTED_CLASS: Record<ChipTone, string> = {
  now: "border-tag-now bg-tag-now text-ink",
  later: "border-tag-later bg-tag-later text-ink",
  wonder: "border-tag-wonder bg-tag-wonder text-ink",
  do: "border-do bg-do text-ink",
  drop: "border-drop bg-drop text-ink",
  neutral: "border-mark bg-mark text-mark-text",
};

export function Chip({
  selected = false,
  tone = "neutral",
  className = "",
  type = "button",
  children,
  ...rest
}: ChipProps) {
  const selectedClass = SELECTED_CLASS[tone];
  const idleClass = "border-line bg-raised text-muted";

  return (
    <button
      type={type}
      className={`rounded-full border px-3 py-1 text-sm ${selected ? selectedClass : idleClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
