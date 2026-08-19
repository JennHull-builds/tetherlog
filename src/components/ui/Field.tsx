import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEventHandler,
  type MutableRefObject,
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

const FIELD_CLASS =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-ink";

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
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  function setTextAreaRef(node: HTMLTextAreaElement | null) {
    innerRef.current = node;
    if (typeof inputRef === "object" && inputRef) {
      (
        inputRef as MutableRefObject<
          HTMLInputElement | HTMLTextAreaElement | null
        >
      ).current = node;
    }
  }

  function setInputRef(node: HTMLInputElement | null) {
    if (typeof inputRef === "object" && inputRef) {
      (
        inputRef as MutableRefObject<
          HTMLInputElement | HTMLTextAreaElement | null
        >
      ).current = node;
    }
  }

  useLayoutEffect(() => {
    if (maxLines <= 1) return;
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = 1.5 * 16 * maxLines + 24;
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, [value, maxLines]);

  if (maxLines > 1) {
    return (
      <textarea
        ref={setTextAreaRef}
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
        className={`${FIELD_CLASS} resize-none text-lg leading-relaxed ${className}`}
      />
    );
  }

  return (
    <input
      ref={setInputRef}
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
      className={`${FIELD_CLASS} ${className}`}
    />
  );
}
