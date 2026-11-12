import { useEffect, useRef, useState } from "react";
import { Button } from "nil-ds";
import { copyText } from "../../lib/hands";

export interface CopyButtonProps {
  /** Returns the text to copy, read at press time. */
  getText: () => string;
  children: string;
}

const COPIED_MS = 2000;

/**
 * A ghost Button that says it worked. For two seconds the icon becomes a tick
 * and the label reads "Copied". The two labels share one grid cell, so the
 * button keeps the width of the longer one and a wrapping row never reflows.
 */
export function CopyButton({ getText, children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handlePress() {
    try {
      await copyText(getText());
    } catch (error) {
      console.warn("[tetherlog] copy failed", error);
      return;
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, COPIED_MS);
  }

  return (
    <span className="inline-flex">
      <Button variant="ghost" icon={copied ? "check" : "copy"} onClick={() => void handlePress()}>
        <span style={{ display: "inline-grid" }}>
          <span
            style={{ gridArea: "1 / 1", visibility: copied ? "hidden" : undefined }}
            aria-hidden={copied || undefined}
          >
            {children}
          </span>
          <span
            style={{ gridArea: "1 / 1", visibility: copied ? undefined : "hidden" }}
            aria-hidden={!copied || undefined}
          >
            Copied
          </span>
        </span>
      </Button>
      <span className="nil-sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}
