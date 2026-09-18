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
  padding: "var(--nil-spacing-sm) var(--nil-spacing-md)",
  fontFamily: "var(--nil-font-body)",
  fontSize: "var(--nil-type-scale-base)",
  lineHeight: 1.5,
  color: "var(--nil-color-text)",
  background: "var(--nil-color-bg)",
  border: "var(--nil-border-width) solid var(--nil-color-border)",
  borderRadius: "var(--nil-radius-none)",
  outline: "none",
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
        className={`resize-none text-lg leading-relaxed placeholder:text-muted ${className}`}
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
