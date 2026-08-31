import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--nil-color-accent)",
    color: "var(--nil-color-accent-contrast)",
    border: "var(--nil-border-width) solid transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--nil-color-text)",
    border: "var(--nil-border-width) solid var(--nil-color-border)",
  },
  danger: {
    background: "transparent",
    color: "var(--nil-color-danger)",
    border: "var(--nil-border-width) solid var(--nil-color-danger)",
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
        fontFamily: "var(--nil-font-body)",
        fontWeight: 600,
        borderRadius: "var(--nil-radius-none)",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: fullWidth
          ? "var(--nil-spacing-md) var(--nil-spacing-lg)"
          : "var(--nil-spacing-sm) var(--nil-spacing-lg)",
        fontSize: fullWidth
          ? "var(--nil-type-scale-base)"
          : "var(--nil-type-scale-base)",
        width: fullWidth ? "100%" : undefined,
        transition: `background var(--nil-motion-duration-base) var(--nil-motion-easing-standard)`,
        ...variantStyles[variant],
        ...(disabled
          ? {
              opacity: 0.55,
              background: "var(--nil-color-surface)",
              color: "var(--nil-color-text-muted)",
              border: "var(--nil-border-width) solid var(--nil-color-border)",
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
