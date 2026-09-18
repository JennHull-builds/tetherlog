import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** NIL DS Card — token-only, inlined to avoid cross-repo React type skew. */
export function Card({ children, className = "", style, ...rest }: CardProps) {
  const shell: CSSProperties = {
    backgroundColor: "var(--tl-raised)",
    border: "var(--tl-border-width) solid var(--tl-rule)",
    borderRadius: "var(--tl-radius)",
    padding: "var(--tl-space-md)",
    ...style,
  };

  return (
    <div className={className} style={shell} {...rest}>
      {children}
    </div>
  );
}
