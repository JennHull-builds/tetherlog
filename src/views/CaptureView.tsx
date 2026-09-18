import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { GravityField, type Well } from "../components/GravityField";
import {
  Chip,
  Field,
  IconButton,
  MicGlyph,
  ParkGlyph,
  PeekStack,
  StopGlyph,
} from "../components/ui";
import { getCapturesForDay, parkCapture, type ParkCaptureOptions } from "../db";
import { readDurationMs } from "../lib/motion";
import {
  formatDuration,
  isVoiceSupported,
  VoiceSession,
} from "../lib/voice";
import type { Capture, CaptureTag } from "../types";
import { todayKey } from "../types";

interface CaptureViewProps {
  onParked: () => void;
}

const TAGS: { value: CaptureTag; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "later", label: "Later" },
  { value: "?", label: "?" },
];

const TAG_TONE = {
  now: "now",
  later: "later",
  "?": "wonder",
} as const;

/** Stable empty default: useLiveQuery returns its third argument while loading. */
const NO_CAPTURES: Capture[] = [];

/** A thought held outside React state between the release and the write. */
interface Held {
  text: string;
  tag?: CaptureTag;
  /** Present for a voice park, which carries audio the text form does not. */
  options?: ParkCaptureOptions;
}

function hapticPark(): void {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* some browsers expose vibrate but reject it */
  }
}

/**
 * Capture.
 *
 * THREE ELEMENTS AT REST: the headline, the sub-line, and the field. Mic and
 * Park live inside the field as glyphs, the tag chips do not exist until there
 * is something to tag, and the one reserved line under the field carries the
 * chips or the confirm word but never both at once, so nothing on this screen
 * ever shifts. It was six elements before Phase 4. See docs/DECISIONS.md D-014.
 *
 * THE PARK IS OPTIMISTIC AND THE ORDER IS THE WHOLE THING: hold, release,
 * settle, recover. Nothing between the hold and the release may be async.
 * Read docs/DECISIONS.md D-004 before changing a line of handlePark, including
 * its symptom-to-cause table, which is written for 4am.
 */
export function CaptureView({ onParked }: CaptureViewProps) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<CaptureTag | undefined>();
  const [status, setStatus] = useState<"idle" | "parked">("idle");
  const [parkError, setParkError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [commitKey, setCommitKey] = useState(0);
  const [well, setWell] = useState<Well | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const sessionRef = useRef<VoiceSession | null>(null);
  const recordStartedAtRef = useRef(0);

  /**
   * The held thoughts, keyed by ticket. A REF, not state: it must not trigger
   * a re-render and it must survive one, because the re-render is the release.
   * This is the only copy of the user's words outside React state.
   */
  const inFlightRef = useRef(new Map<number, Held>());
  const ticketRef = useRef(0);
  /** Where to put the caret back after a recovery rewrites the field. */
  const caretRef = useRef<number | null>(null);

  const voiceOk = isVoiceSupported();
  const dayKey = todayKey();
  const captures = useLiveQuery(
    () => getCapturesForDay(dayKey),
    [dayKey],
    NO_CAPTURES,
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onSlash(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);

  useEffect(() => {
    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - recordStartedAtRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [recording]);

  /**
   * Where the lens has to bend space. Measured from the DOM rather than
   * assumed, because the field grows to three lines and the phone keyboard
   * moves it. ResizeObserver only, no polling: the identity guard means an
   * unchanged rect does not re-render, so the lens is not asked to redraw.
   */
  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    function measure() {
      const node = shellRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const radius =
        Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;

      setWell((prev) =>
        prev &&
        prev.x === r.x &&
        prev.y === r.y &&
        prev.width === r.width &&
        prev.height === r.height &&
        prev.radius === radius
          ? prev
          : { x: r.x, y: r.y, width: r.width, height: r.height, radius },
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Runs on every keystroke and does nothing on almost all of them.
  useEffect(() => {
    const caret = caretRef.current;
    if (caret === null) return;
    caretRef.current = null;
    inputRef.current?.setSelectionRange(caret, caret);
  }, [text]);

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }

  /**
   * STEP 2. The field is ready again. Synchronous, top to bottom, with nothing
   * async anywhere above the call to this function.
   *
   * It does not read inFlightRef and must never start to. Motion and
   * persistence are independent; coupling them is how a slow disk becomes a
   * stuck animation.
   */
  function releaseField() {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];

    setText("");
    setTag(undefined);
    setParkError(null);
    onParked();
    inputRef.current?.focus();
    hapticPark();

    // The lens pulse. A counter, so two parks in a second give two distinct
    // effect runs and the second restarts the arc rather than queueing.
    setCommitKey((key) => key + 1);
    setStatus("parked");

    // 600ms, or 1200ms under reduced motion: the token carries both, and the
    // media query in the generated stylesheet is what picks. With no travel
    // the word is carrying more of the answer, so it holds about twice as long.
    later(readDurationMs("--tl-duration-confirm", 600), () =>
      setStatus("idle"),
    );
  }

  /**
   * STEP 4. A failed park never clears silently and never auto-retries: a
   * silent retry can double-write.
   */
  function restoreFailedPark(held: Held, error: unknown) {
    // The words first, unconditionally, before any state is touched. If the UI
    // recovery below also fails, this line is the only thing standing between
    // the user and a silently lost capture. Part of the change, not an extra.
    console.warn("[tetherlog] park failed. The text was:", held.text, error);

    setTag((current) => current ?? held.tag);
    setText((current) => {
      // Never overwrite what has been typed since. Losing the new thought to
      // recover the old one is not a fix.
      const typedSince = current.trim();
      if (!typedSince) return held.text;
      // The recovered thought goes on its own line below, and the caret goes
      // back where the person actually was. Without this, a failure landing
      // mid-word moves the caret to the end of the recovered line and the rest
      // of what they were typing lands inside someone else's sentence: nothing
      // is lost, and it still arrives shredded, at the exact moment they are
      // being told the last one failed. Writing the ref inside the updater is
      // idempotent, so a double invocation cannot corrupt it.
      caretRef.current = typedSince.length;
      return `${typedSince}\n${held.text}`;
    });
    setParkError("That one did not save. It is back in the field.");
    setStatus("idle");
  }

  /** STEP 3. Behind the user. The only place parkCapture is ever called. */
  async function settlePark(ticket: number) {
    const held = inFlightRef.current.get(ticket);
    if (!held) return;

    try {
      await parkCapture(held.options ?? { text: held.text, tag: held.tag });
      // Cleared on BOTH paths. A hold left behind is how one Park becomes two
      // captures the next time somebody adds a retry.
      inFlightRef.current.delete(ticket);
    } catch (error) {
      inFlightRef.current.delete(ticket);
      restoreFailedPark(held, error);
    }
  }

  function hold(held: Held): number {
    const ticket = ++ticketRef.current;
    inFlightRef.current.set(ticket, held);
    return ticket;
  }

  /**
   * NOT async, and it must never become async. The release has to happen in
   * the same synchronous block as the keypress, or the field's readiness
   * becomes a function of something else again. See D-004 rule 1.
   */
  function handlePark(event?: React.FormEvent) {
    event?.preventDefault();
    if (recording) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    // 1. HOLD, before anything is cleared.
    const ticket = hold({ text: trimmed, tag });
    // 2. RELEASE.
    releaseField();
    // 3. SETTLE, behind the user.
    void settlePark(ticket);
  }

  async function startRecording() {
    if (recording) return;
    setVoiceError(null);

    const session = new VoiceSession();
    try {
      await session.start();
    } catch (err) {
      session.dispose();
      setVoiceError(
        err instanceof Error ? err.message : "Could not start the microphone.",
      );
      return;
    }

    sessionRef.current = session;
    recordStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setRecording(true);
  }

  /**
   * The same hold, release, settle, with one difference that matters: the
   * words do not exist until `stop()` resolves, so that await is the one async
   * step allowed above a release. Everything after it is the ordinary order.
   */
  async function stopAndParkVoice() {
    if (!recording) return;
    const session = sessionRef.current;
    if (!session) return;

    setRecording(false);
    setVoiceError(null);
    const parkedTag = tag;

    let result: Awaited<ReturnType<VoiceSession["stop"]>>;
    try {
      result = await session.stop();
    } catch (err) {
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setElapsedMs(0);
      setVoiceError(
        err instanceof Error ? err.message : "Could not park the recording.",
      );
      return;
    }
    sessionRef.current = null;

    const ticket = hold({
      text: result.text,
      tag: parkedTag,
      options: {
        text: result.text,
        tag: parkedTag,
        audioBlob: result.audioBlob,
        audioMimeType: result.audioMimeType,
        durationMs: result.durationMs,
        transcriptStatus: result.transcriptStatus,
      },
    });
    releaseField();
    setElapsedMs(0);
    void settlePark(ticket);
  }

  const armed = recording || text.trim().length > 0;
  const showChips = !recording && text.trim().length > 0;

  return (
    <section
      className="relative flex min-h-[calc(100dvh-5.5rem)] flex-col pt-16 pb-6"
      style={{ paddingInline: "var(--tl-gutter)" }}
      onClick={() => {
        if (!recording) inputRef.current?.focus();
      }}
    >
      <GravityField well={well} focused={focused} commitKey={commitKey} />

      <div className="relative z-10 flex flex-1 flex-col justify-center gap-8">
        <header className="space-y-2">
          <h1 className="text-display font-light tracking-display text-ink">
            What's pulling you?
          </h1>
          <p className="text-small text-muted">Park it. Sort it tonight.</p>
        </header>

        <form
          onSubmit={(event) => handlePark(event)}
          className="space-y-3"
          onClick={(event) => event.stopPropagation()}
        >
          <Field
            inputRef={inputRef}
            shellRef={shellRef}
            rim
            value={text}
            onChange={setText}
            onFocusChange={setFocused}
            placeholder={
              recording ? "Recording… stop when done" : "One line is enough"
            }
            autoComplete="off"
            enterKeyHint="done"
            maxLines={3}
            disabled={recording}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handlePark();
              }
            }}
            trailing={
              <div className="flex items-center justify-end gap-2">
                {recording ? (
                  <>
                    <p
                      className="mr-auto text-body text-muted"
                      aria-live="polite"
                    >
                      Recording {formatDuration(elapsedMs)}
                    </p>
                    <IconButton
                      label="Stop and park"
                      tone="primary"
                      armed
                      onClick={() => void stopAndParkVoice()}
                    >
                      <StopGlyph />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <IconButton
                      label={
                        voiceOk
                          ? "Mic"
                          : "Mic needs HTTPS (Vercel preview or localhost)."
                      }
                      disabled={!voiceOk}
                      onClick={() => void startRecording()}
                    >
                      <MicGlyph />
                    </IconButton>
                    <IconButton
                      label="Park"
                      tone="primary"
                      type="submit"
                      armed={armed}
                    >
                      <ParkGlyph />
                    </IconButton>
                  </>
                )}
              </div>
            }
          />

          {/*
            ONE reserved line, three jobs: empty at rest, the tag chips once
            there is something to tag, the confirm word after a park. It is
            always this tall, so nothing on the screen ever moves, and the two
            can never collide because a park empties the field.

            No transition on the chips. Nothing animates in response to typing.
          */}
          <div className="relative flex h-11 items-center">
            <p
              className="absolute text-body text-muted"
              aria-live="polite"
              aria-atomic="true"
            >
              {status === "parked" ? "Parked." : ""}
            </p>
            <div
              className="flex flex-wrap gap-2"
              style={{ visibility: showChips ? "visible" : "hidden" }}
            >
              {TAGS.map((option) => (
                <Chip
                  key={option.value}
                  tone={TAG_TONE[option.value]}
                  selected={tag === option.value}
                  tabIndex={showChips ? undefined : -1}
                  onClick={() =>
                    setTag(tag === option.value ? undefined : option.value)
                  }
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>

          {(parkError || voiceError) && (
            <p className="text-body text-danger" role="alert">
              {parkError ?? voiceError}
            </p>
          )}
        </form>
      </div>

      {/*
        A FIXED slot, always here, whether or not anything is in it. Rendering
        the stack conditionally shrank the flex-1 block above it, so the field
        rose by about 66px the first time anything was parked: the one screen
        that must never move, moving, at the exact moment a person is watching
        it to see whether their thought landed. Reserved space costs nothing on
        an empty screen and it cannot shift.
      */}
      <div className="relative z-10 h-32 overflow-hidden">
        {captures.length > 0 && <PeekStack captures={captures} />}
      </div>
    </section>
  );
}
