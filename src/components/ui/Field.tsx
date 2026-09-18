import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEventHandler,
  type RefObject,
} from "react";

export interface FieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "number";
  autoComplete?: string;
  enterKeyHint?: "done" | "enter" | "go" | "next" | "search" | "send";
  min?: number;
  max?: number;
  /** 1 = single line. 2–3 = optional expand, not an essay. */
  maxLines?: 1 | 2 | 3;
  disabled?: boolean;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "var(--tl-space-md) var(--tl-space-lg)",
  fontFamily: "var(--tl-font-body)",
  // 17px, and NEVER below it. This is the one place a person types while
  // distracted. An inline style beats a utility class, so this line is what
  // actually decides the size: setting text-input on the element does nothing
  // while this says otherwise. See docs/LOOK.md.
  fontSize: "var(--tl-text-input)",
  letterSpacing: "var(--tl-tracking-input)",
  lineHeight: "var(--tl-leading-body)",
  color: "var(--tl-ink)",
  // Barely lighter than the ground, per docs/LOOK.md. Phase 4 gives it mass.
  background: "var(--tl-field)",
  border: "var(--tl-border-width) solid var(--tl-rule)",
  borderRadius: "var(--tl-radius-field)",
  outline: "none",
  // The autosize effect below sets height from scrollHeight, so a scrollbar
  // track can never be needed. Leaving it auto painted a visible sliver down
  // the right edge of the field at 390px.
  overflow: "hidden",
  resize: "none",
};

export function Field({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  enterKeyHint,
  min,
  max,
  maxLines = 1,
  disabled,
  className = "",
  inputRef,
  onKeyDown,
}: FieldProps) {
  const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Hand the caller the live node. useImperativeHandle rather than writing to
  // inputRef.current by hand: mutating a prop's ref during a ref callback is
  // what the React Compiler rejects, and this is the sanctioned equivalent.
  // CaptureView only ever calls .focus() on it, and that call is step 2 of the
  // optimistic park, so it must stay synchronous. See docs/DECISIONS.md D-004.
  useImperativeHandle<
    HTMLInputElement | HTMLTextAreaElement | null,
    HTMLInputElement | HTMLTextAreaElement | null
  >(inputRef, () => innerRef.current);

  useLayoutEffect(() => {
    if (maxLines <= 1) return;
    const el = innerRef.current;
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = "auto";
    const cap = 1.5 * 16 * maxLines + 24;
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, [value, maxLines]);

  if (maxLines > 1) {
    return (
      <textarea
        ref={innerRef as RefObject<HTMLTextAreaElement | null>}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        disabled={disabled}
        rows={1}
        className={`resize-none text-input leading-relaxed placeholder:text-muted ${className}`}
        style={FIELD_STYLE}
      />
    );
  }

  return (
    <input
      ref={innerRef as RefObject<HTMLInputElement | null>}
      type={type}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value)
      }
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoComplete={autoComplete}
      enterKeyHint={enterKeyHint}
      min={min}
      max={max}
      disabled={disabled}
      className={`placeholder:text-muted ${className}`}
      style={FIELD_STYLE}
    />
  );
}
