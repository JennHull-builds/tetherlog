import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** NIL DS Card — token-only, inlined to avoid cross-repo React type skew. */
export function Card({ children, className = "", style, ...rest }: CardProps) {
  const shell: CSSProperties = {
    backgroundColor: "var(--nil-color-surface)",
    border: "var(--nil-border-width) solid var(--nil-color-border)",
    borderRadius: "var(--nil-radius-none)",
    padding: "var(--nil-spacing-md)",
    ...style,
  };

  return (
    <div className={className} style={shell} {...rest}>
      {children}
    </div>
  );
}
