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
  /** The shell, for measuring the well the lens has to bend space around. */
  shellRef?: RefObject<HTMLDivElement | null>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  /**
   * Controls that sit INSIDE the field, on its trailing edge. Phase 4 moved
   * Mic and Park in here: the direction is one heavy object with space bent
   * around it, and a button row underneath is a second object competing with
   * it. See docs/DECISIONS.md D-014.
   */
  trailing?: ReactNode;
  /** Focus drives the lens, so the view needs to know, not just the CSS. */
  onFocusChange?: (focused: boolean) => void;
  /**
   * The luminous rim. OFF by default, and the default is the point.
   *
   * The rim is the capture field's mass signature, not a generic input
   * treatment. Making it the default put the accent rim on the API key field
   * and the reminder hour, so Settings rested with the one colour per screen
   * appearing three times. Only the capture field asks for it.
   */
  rim?: boolean;
  /**
   * D-016: the shell goes transparent and borderless, so the WebGL lens body
   * painted behind it (GravityField.tsx) is what the user actually sees —
   * fill, border and rim all become the shader's job. Only ever true once
   * `GravityField`'s `onReady` has fired true; false (the CSS fallback below)
   * is what the ~2% of devices with no WebGL keep, and what every field
   * renders as for the first frame or two before the lens context exists.
   * Meaningless without `rim`: nothing but the capture field asks for either.
   */
  glass?: boolean;
}

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
  // A COLUMN, always, whether or not there is anything trailing. Controls sit
  // under the text rather than beside it: at 390px a row leaves about 22
  // characters visible in the one place a distracted person types, and the
  // field is also a textarea that grows to three lines.
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "var(--tl-space-sm)",
  width: "100%",
  padding: "var(--tl-space-md) var(--tl-space-lg)",
  // Barely lighter than the ground, per docs/LOOK.md. The lens gives it mass.
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
  glass = false,
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
    const cap = 1.5 * 16 * maxLines + 24;
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
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
   * restarts the lens arc.
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
    style: CONTROL_STYLE,
    className: `placeholder:text-muted ${className}`,
  };

  return (
    <div
      ref={shellRef}
      onMouseDown={handleShellPointerDown}
      style={{
        ...SHELL_STYLE,
        // The rim brightens on focus. Scale is never a focus indicator here,
        // and neither is the fill: both are carried by this one line plus the
        // deeper bend in the lens behind it.
        //
        // The width is constant within a variant. Thickening a border on focus
        // moves everything inside it by a pixel, and this field has a caret in
        // it at the time.
        borderWidth: rim ? "var(--tl-rim-width)" : "var(--tl-border-width)",
        // Glass mode: the shader draws its own rim (uRimStrength), so the CSS
        // border steps aside rather than doubling it. Transparent, not simply
        // absent — the width above still reserves the same box, so nothing
        // reflows when `glass` flips.
        borderColor: glass
          ? "transparent"
          : focused
            ? "var(--tl-rim-focus)"
            : rim
              ? "var(--tl-rim)"
              : "var(--tl-rule)",
        background: glass ? "transparent" : focused ? "var(--tl-field-focus)" : "var(--tl-field)",
        transition:
          "border-color var(--tl-spring-focus-duration) var(--tl-spring-focus-ease), " +
          "background var(--tl-spring-focus-duration) var(--tl-spring-focus-ease)",
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
      {trailing}
    </div>
  );
}
