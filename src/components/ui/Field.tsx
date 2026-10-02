import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactNode,
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
  /** The shell, for measuring the field the grid makes room around. */
  shellRef?: RefObject<HTMLDivElement | null>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  /**
   * Controls that sit INSIDE the field, on its trailing edge. Phase 4 moved
   * Mic and Park in here: the direction is one heavy object with space bent
   * around it, and a button row underneath is a second object competing with
   * it. See docs/DECISIONS.md D-014.
   */
  trailing?: ReactNode;
  /** Focus drives the grid, so the view needs to know, not just the CSS. */
  onFocusChange?: (focused: boolean) => void;
  /**
   * The capture field's heavier edge. OFF by default, and the default is the
   * point: only the capture field asks for it.
   *
   * Since D-027 it rests on the structural rule like every other field, at the
   * rim width, and turns accent only on focus. It used to rest in the accent,
   * which put the one colour per screen on the field and the Park button at
   * once. Before that it was the default for every field, which put it on the
   * API key and the reminder hour too.
   */
  rim?: boolean;
  /**
   * The trailing controls sit on the same line as the text, pinned to its last
   * line, so the field is ONE line at rest and grows downward as the words
   * wrap. Only the capture field asks for it (D-029). Without it the controls
   * sit underneath, which is what recording uses.
   */
  controlsBeside?: boolean;
  /**
   * Hold the shell at least this tall, in CSS pixels. Capture holds the height
   * the field had at the park while the words sink out of it, then lets go and
   * the field relaxes back to one line on the settle spring.
   */
  holdHeight?: number | null;
}

/**
 * One tap target tall. The text inside a field with its controls beside it is padded to the 44px
 * the control beside it needs, so a single line sits centred against it.
 */
const TARGET = 44;

/**
 * The shell carries the whole appearance: ground, rim and radius. The control
 * inside is transparent and borderless.
 *
 * There is exactly one code path here. An earlier draft styled the input
 * directly when there was no `trailing` and used a shell when there was, and
 * two paths for one primitive is how a field ends up looking different on two
 * screens for no reason anybody can find later.
 */
const SHELL_STYLE: CSSProperties = {
  // A COLUMN by default, with any controls under the text. The capture field
  // overrides this with `controlsBeside`: one control beside the text rather
  // than two, which is what leaves room for the words at 390px (D-029).
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "var(--tl-space-sm)",
  width: "100%",
  padding: "var(--tl-space-md) var(--tl-space-lg)",
  // Barely lighter than the ground, per docs/LOOK.md. The grid gives it room.
  background: "var(--tl-field)",
  borderRadius: "var(--tl-radius-field)",
  borderStyle: "solid",
  // Set per variant below. NEVER the decorative hairline: this is the edge of
  // an input and a user has to be able to see it. See CLAUDE.md rule 6.
  position: "relative",
};

const CONTROL_STYLE: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
  width: "100%",
  padding: 0,
  margin: 0,
  fontFamily: "var(--tl-font-body)",
  // 17px, and NEVER below it. This is the one place a person types while
  // distracted. A style attribute beats a utility class, so this line is what
  // actually decides the size: setting text-input on the element does nothing
  // while this says otherwise. See docs/LOOK.md.
  fontSize: "var(--tl-text-input)",
  letterSpacing: "var(--tl-tracking-input)",
  lineHeight: "var(--tl-leading-body)",
  color: "var(--tl-ink)",
  background: "transparent",
  border: "none",
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
  shellRef,
  onKeyDown,
  trailing,
  onFocusChange,
  rim = false,
  controlsBeside = false,
  holdHeight = null,
}: FieldProps) {
  const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);

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
    // Measured, not assumed: the cap is maxLines of the field's own line
    // height plus its own padding, which `controlsBeside` changes.
    const cs = getComputedStyle(el);
    const line = Number.parseFloat(cs.lineHeight) || 24;
    const pad = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
    el.style.height = `${Math.min(el.scrollHeight, line * maxLines + pad)}px`;
  }, [value, maxLines]);

  function handleFocus() {
    setFocused(true);
    onFocusChange?.(true);
  }

  function handleBlur() {
    setFocused(false);
    onFocusChange?.(false);
  }

  /**
   * THE WHOLE FIELD IS THE TARGET, not just the line of text in it.
   *
   * The shell is padded and grows to three lines, so most of its area is not
   * the control. Clicking that area did nothing: CaptureView focuses the input
   * from a click on the screen, and the form around this field stops
   * propagation so the buttons work, which killed it for the field too. The
   * fix belongs here rather than there, because it is this component's shape
   * that makes the dead area.
   *
   * mousedown rather than click, with preventDefault: the shell would
   * otherwise take focus for a frame first, which reads as a flicker and
   * restarts the grid's focus arc.
   */
  function handleShellPointerDown(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target === innerRef.current) return;
    if (target instanceof HTMLElement && target.closest("button")) return;
    event.preventDefault();
    innerRef.current?.focus();
  }

  const shared = {
    onKeyDown,
    onFocus: handleFocus,
    onBlur: handleBlur,
    placeholder,
    autoComplete,
    enterKeyHint,
    disabled,
    style: controlsBeside
      ? {
          ...CONTROL_STYLE,
          paddingBlock: `calc((${TARGET}px - var(--tl-text-input) * var(--tl-leading-body)) / 2)`,
        }
      : CONTROL_STYLE,
    className: `placeholder:text-muted ${className}`,
  };

  return (
    <div
      ref={shellRef}
      onMouseDown={handleShellPointerDown}
      style={{
        ...SHELL_STYLE,
        ...(controlsBeside
          ? {
              flexDirection: "row",
              alignItems: "flex-end",
              padding:
                "var(--tl-space-sm) var(--tl-space-sm) var(--tl-space-sm) var(--tl-space-lg)",
            }
          : null),
        minHeight: holdHeight ?? undefined,
        // The edge brightens on focus. Scale is never a focus indicator here,
        // and neither is the fill: both are carried by this one line plus the
        // extra room the grid gives the field behind it.
        //
        // The width is constant within a variant. Thickening a border on focus
        // moves everything inside it by a pixel, and this field has a caret in
        // it at the time.
        borderWidth: rim ? "var(--tl-rim-width)" : "var(--tl-border-width)",
        borderColor: focused ? "var(--tl-rim-focus)" : "var(--tl-rule)",
        background: focused ? "var(--tl-field-focus)" : "var(--tl-field)",
        transition:
          "border-color var(--tl-spring-focus-duration) var(--tl-spring-focus-ease), " +
          "background var(--tl-spring-focus-duration) var(--tl-spring-focus-ease), " +
          "min-height var(--tl-spring-settle-duration) var(--tl-spring-settle-ease)",
      }}
    >
      {maxLines > 1 ? (
        <textarea
          {...shared}
          ref={innerRef as RefObject<HTMLTextAreaElement | null>}
          rows={1}
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            onChange(event.target.value)
          }
        />
      ) : (
        <input
          {...shared}
          ref={innerRef as RefObject<HTMLInputElement | null>}
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
      )}
      {controlsBeside && trailing ? (
        <div style={{ flex: "0 0 auto" }}>{trailing}</div>
      ) : (
        trailing
      )}
    </div>
  );
}
