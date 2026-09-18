import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--tl-mark)",
    color: "var(--tl-on-mark)",
    border: "var(--tl-border-width) solid transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--tl-ink)",
    border: "var(--tl-border-width) solid var(--tl-rule)",
  },
  danger: {
    background: "transparent",
    color: "var(--tl-danger)",
    border: "var(--tl-border-width) solid var(--tl-danger)",
  },
};

/** NIL DS Button — token-only, inlined to avoid cross-repo React type skew. */
export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  style,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={["nil-btn", className].filter(Boolean).join(" ")}
      style={{
        fontFamily: "var(--tl-font-body)",
        // 500. The scale is 300/400/500; 600 was off it.
        fontWeight: 500,
        borderRadius: "var(--tl-radius)",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: fullWidth
          ? "var(--tl-space-md) var(--tl-space-lg)"
          : "var(--tl-space-sm) var(--tl-space-lg)",
        fontSize: fullWidth
          ? "var(--tl-text-body)"
          : "var(--tl-text-body)",
        width: fullWidth ? "100%" : undefined,
        transition: `background var(--tl-spring-dismiss-duration) var(--tl-ease-standard)`,
        ...variantStyles[variant],
        ...(disabled
          ? {
              opacity: 0.55,
              background: "var(--tl-raised)",
              color: "var(--tl-ink-muted)",
              border: "var(--tl-border-width) solid var(--tl-rule)",
            }
          : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
