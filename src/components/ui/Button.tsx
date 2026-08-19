import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-mark text-mark-text disabled:cursor-not-allowed disabled:opacity-40",
  ghost: "border border-line bg-raised text-ink disabled:opacity-40",
  danger: "border border-line bg-drop text-ink disabled:opacity-40",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-xl px-4 py-3 text-sm font-medium ${VARIANT_CLASS[variant]} ${fullWidth ? "w-full py-4 text-base" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
