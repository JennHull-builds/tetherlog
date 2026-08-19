import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-line bg-raised p-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
