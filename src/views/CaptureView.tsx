import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Composer, Heading, Text } from "nil-ds";
import { SampleOffer } from "../components/Sample";
import { PeekStack } from "../components/ui";
import {
  getCapturesForDay,
  getSettings,
  getUntriagedCaptures,
  parkCapture,
  type ParkCaptureOptions,
} from "../db";
import { prefersReducedMotion, readDurationMs } from "../lib/motion";
import { playParkSound } from "../lib/sound";
import {
  formatDuration,
  isVoiceSupported,
  VoiceSession,
} from "../lib/voice";
import type { Capture, CaptureTag } from "../types";
import { todayKey } from "../types";

interface CaptureViewProps {
  onParked: () => void;
  /** The quiet "N waiting to sort" link goes here. */
  onOpenReview: () => void;
}

/**
 * ONE tag is offered (D-035): Today, stored as the existing "now" tag so every
 * older capture keeps working. "later" and "?" stay in the data model and in
 * triage, so anything tagged before this still sorts as it did; they are just
 * no longer on the screen.
 */
const TODAY_TAG: CaptureTag = "now";

/** How much of what the browser has heard so far is shown while recording. */
const HEARD_MAX_CHARS = 140;

/** Stable empty default: useLiveQuery returns its third argument while loading. */
const NO_CAPTURES: Capture[] = [];

/**
 * A copy of a parked thought, sinking out of the field after the field itself
 * is already empty. Keyed by the park's ticket, so two parks never share one.
 */
interface Sink {
  id: number;
  text: string;
  left: number;
  top: number;
  width: number;
  /** The text box's visible height: the copy is clipped to it, as the words were. */
  clip: number;
  /** How far the text box had scrolled, so a long thought sinks from where it showed. */
  scrolled: number;
  /** How tall the field was at the park. It holds that height until this has sunk. */
  height: number;
}

/** Each character starts a little after the one before it, up to a cap. */
const SINK_STAGGER_MS = 8;
const SINK_STAGGER_CAP_MS = 180;

/** A thought held outside React state between the release and the write. */
interface Held {
  text: string;
  tag?: CaptureTag;
  /** Present for a voice park, which carries audio the text form does not. */
  options?: ParkCaptureOptions;
}

/**
 * A mouse or a trackpad, rather than a finger.
 *
 * It gates the two places this screen takes focus on its own. On a pointer
 * device, landing ready to type is the whole promise: park in under five
 * seconds, no clicks spent. On a touch device the same line opens the keyboard
 * over half the screen before anyone has asked for it, which is the opposite
 * of a calm room, and the first thing a person does is dismiss it.
 *
 * Read on every call rather than cached: a tablet with a keyboard attached and
 * removed changes the answer without reloading the page.
 */
function hasFinePointer(): boolean {
  try {
    return window.matchMedia("(pointer: fine)").matches;
  } catch {
    return false;
  }
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
 * TWO ELEMENTS AT REST: the headline and the field. Mic and Park live inside
 * the field as glyphs, the tag chips do not exist until there is something to
 * tag, and the one reserved line under the field carries the chips or the
 * confirm word but never both at once, so nothing on this screen ever shifts.
 * Six before Phase 4, three after it (D-014), two since the sub-line went
 * (D-019).
 *
 * THE PARK IS OPTIMISTIC AND THE ORDER IS THE WHOLE THING: hold, release,
 * settle, recover. Nothing between the hold and the release may be async.
 * Read docs/DECISIONS.md D-004 before changing a line of handlePark, including
 * its symptom-to-cause table, which is written for 4am.
 */
export function CaptureView({ onParked, onOpenReview }: CaptureViewProps) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<CaptureTag | undefined>();
  const [status, setStatus] = useState<"idle" | "parked">("idle");
  const [parkError, setParkError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [sinking, setSinking] = useState<Sink[]>([]);
  /** Words the browser has heard so far while recording, shown muted. */
  const [heard, setHeard] = useState("");

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const countRef = useRef<HTMLParagraphElement | null>(null);
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
  const settings = useLiveQuery(getSettings, [], null);
  const waiting = useLiveQuery(
    async () => (await getUntriagedCaptures()).length,
    [],
    0,
  );

  useEffect(() => {
    // NOT on touch. See hasFinePointer: this line used to open the phone
    // keyboard on load, over a screen nobody had tapped yet.
    if (hasFinePointer()) inputRef.current?.focus();
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
    // Commit only, on by default since D-019: nothing responds to typing, and
    // this is acknowledgment, not a reward chime, so it stays quiet.
    if (settings?.soundEnabled) playParkSound();

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
    // The words sink out of the field. Synchronous, and safe after the
    // release: React has not re-rendered yet, so the field still shows them
    // and can be measured. Never awaited, and nothing reads it back.
    sink(ticket, text);
    // 3. SETTLE, behind the user.
    void settlePark(ticket);
  }

  /**
   * A transient copy of the words, laid exactly over the field's text, which
   * sinks away while the empty field is already taking the next thought. It
   * lands in the same render as the release, so there is no frame with the
   * words missing and no frame with them twice.
   */
  function sink(id: number, words: string) {
    if (prefersReducedMotion()) return;
    const input = inputRef.current;
    const section = sectionRef.current;
    const shell = input?.closest<HTMLElement>(".nil-composer");
    if (!input || !section || !shell) return;
    const ir = input.getBoundingClientRect();
    const sr = section.getBoundingClientRect();
    // Composer's text box has no padding of its own (the shell's row carries
    // it), so the words start exactly at the box's edge.
    setSinking((current) => [
      ...current,
      {
        id,
        text: words,
        left: ir.left - sr.left,
        top: ir.top - sr.top,
        width: input.clientWidth,
        clip: input.clientHeight,
        scrolled: input.scrollTop,
        height: shell.offsetHeight,
      },
    ]);
  }

  function renderSink(words: string) {
    let index = 0;
    const parts = words.split(/(\s+)/).filter(Boolean);
    const lastIndex = Array.from(words.replace(/\s+/g, "")).length - 1;
    return parts.map((part, p) => {
      if (/^\s+$/.test(part)) return part;
      return (
        <span key={p} className="tl-sink-word">
          {Array.from(part).map((ch, c) => {
            const i = index++;
            return (
              <span
                key={c}
                className="tl-sink-char"
                data-last={i === lastIndex ? "" : undefined}
                style={{ animationDelay: `${Math.min(i * SINK_STAGGER_MS, SINK_STAGGER_CAP_MS)}ms` }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      );
    });
  }

  async function startRecording() {
    if (recording) return;
    setVoiceError(null);

    setHeard("");
    const session = new VoiceSession(setHeard);
    try {
      await session.start();
    } catch (err) {
      session.dispose();
      setHeard("");
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
    // The final text replaces what was shown while speaking.
    setHeard("");
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

  const showChips = !recording && text.trim().length > 0;
  const heldHeight =
    sinking.length > 0 ? Math.max(...sinking.map((x) => x.height)) : null;

  return (
    <section
      ref={sectionRef}
      className="tl-gutter tl-capture-screen relative flex flex-col pt-16 pb-6"
      style={{
        // Fills the viewport above the nav, and above the sample banner while it shows.
        minHeight: "calc(100dvh - var(--nav-h) - var(--sample-banner-h, 0px))",
      }}
      // Click anywhere on the screen to start typing, on a pointer device only.
      // On touch this made every stray tap open the keyboard.
      onClick={() => {
        if (!recording && hasFinePointer()) inputRef.current?.focus();
      }}
    >
      {/* From 1024px this wrapper stops being a box (lg:contents), so the
          headline and the field become cells of the section's grid (D-039). */}
      <div className="flex flex-1 flex-col justify-center gap-8 lg:contents">
        {/*
          TWO ELEMENTS AT REST: the headline and the box. One control inside
          the box (D-029): the Mic on an empty box, Park from the first
          character, Stop and park while recording. D-030 moved this screen
          onto nil-ds, so the look is the kit's, unmodified.
        */}
        <header className="lg:col-start-1 lg:row-start-1">
          <Heading level={1} style={{ fontSize: "var(--nil-type-scale-xl)" }}>
            What's pulling you?
          </Heading>
        </header>

        {/*
          A FIXED HEIGHT: the box at rest, the gap and the reserved line. The
          box is one line at rest and grows as the words wrap (D-029), and a
          centred block that changed height would move the headline while
          somebody types and again at the park. Fixed, the growth spills
          downward into the empty space below and nothing above it moves.
        */}
        <div
          className="tl-capture-form space-y-3 lg:col-start-1 lg:row-start-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Composer
            ref={inputRef}
            label="Capture"
            value={text}
            onValueChange={setText}
            onSend={() => handlePark()}
            sendLabel="Park"
            emptyAction={
              recording ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon="stop"
                  onClick={() => void stopAndParkVoice()}
                >
                  Stop and park
                </Button>
              ) : voiceOk ? (
                <Button
                  size="sm"
                  icon="mic"
                  aria-label="Record a voice note"
                  onClick={() => void startRecording()}
                />
              ) : (
                // Voice is unavailable: nothing is disclosed (D-029), but the
                // slot keeps the height of a button, or the box would get taller by
                // the footer's button the moment the first character swaps
                // Park in.
                <span style={{ visibility: "hidden" }} aria-hidden>
                  <Button
                    size="sm"
                    icon="mic"
                    aria-label="Record a voice note"
                    tabIndex={-1}
                  />
                </span>
              )
            }
            hint={recording ? `Recording ${formatDuration(elapsedMs)}` : false}
            maxRows={3}
            prefix=">"
            placeholder={
              recording ? "Recording… stop when done" : "One line is enough"
            }
            autoComplete="off"
            enterKeyHint="done"
            disabled={recording}
            className={
              sinking.length > 0
                ? "tl-capture-input tl-placeholder-hold"
                : "tl-capture-input"
            }
            style={{
              // Hold the height the box had until the words have sunk, then
              // relax on the settle spring. Collapse it at the park instead and
              // a two-line thought sinks outside the box.
              minHeight: heldHeight ?? undefined,
              transition:
                "border-color var(--nil-motion-duration-fast) var(--nil-motion-easing-standard), min-height var(--tl-spring-settle-duration) var(--tl-spring-settle-ease)",
            }}
          />
          <p className="nil-sr-only" aria-live="polite">
            {recording ? "Recording" : ""}
          </p>

          {/*
            ONE reserved block, four jobs: empty at rest, the Today chip with
            its one line once there is something to tag, the words heard so far
            while recording, and the confirm word after a park. It is always
            this tall (D-035), so nothing on the screen ever moves, and the
            jobs can never collide: a park empties the box, and recording hides
            the chip.

            No transition on the chip. Nothing animates in response to typing.
          */}
          <div className="relative h-16">
            <Text
              size="sm"
              muted
              className="absolute top-0 flex h-8 items-center"
              aria-live="polite"
              aria-atomic="true"
            >
              {status === "parked" ? "Parked." : ""}
            </Text>
            {recording && heard && (
              // Not a live region: interim words change many times a second and
              // a screen reader should not read each one.
              <Text size="sm" muted className="line-clamp-2" aria-hidden>
                {heard.length > HEARD_MAX_CHARS
                  ? `…${heard.slice(-HEARD_MAX_CHARS)}`
                  : heard}
              </Text>
            )}
            <div
              className="flex flex-col items-start gap-1"
              style={{ visibility: showChips ? "visible" : "hidden" }}
            >
              <div className="flex h-8 items-center">
                <Button
                  size="sm"
                  variant={tag === TODAY_TAG ? "secondary" : "ghost"}
                  aria-pressed={tag === TODAY_TAG}
                  tabIndex={showChips ? undefined : -1}
                  style={
                    tag === TODAY_TAG
                      ? { color: "var(--nil-color-text-accent)" }
                      : undefined
                  }
                  onClick={() => setTag(tag === TODAY_TAG ? undefined : TODAY_TAG)}
                >
                  Today
                </Button>
              </div>
              <Text size="sm" muted>
                Optional. Makes it stand out when you review.
              </Text>
            </div>
          </div>

          {(parkError || voiceError) && (
            <Text
              size="sm"
              role="alert"
              style={{ color: "var(--nil-color-text-danger)" }}
            >
              {parkError ?? voiceError}
            </Text>
          )}
        </div>
      </div>

      {/*
        BESIDE THE FIELD from 1024px (D-039): this wrapper sits in the second
        column of the field's row and is zero tall, so what it holds hangs from
        the top of the field and can never change the height the headline and
        the field are centred on. Below 1024px it is an ordinary block and the
        stack and the link sit under the field, as before.
      */}
      <div className="lg:col-start-2 lg:row-start-2 lg:h-0">
        {/*
          A FIXED slot, always here, whether or not anything is in it. Rendering
          the stack conditionally shrank the flex-1 block above it, so the box
          rose by about 66px the first time anything was parked: the one screen
          that must never move, moving, at the exact moment a person is watching
          it to see whether their thought landed. Reserved space costs nothing on
          an empty screen and it cannot shift.
        */}
        <div className="relative h-32 overflow-hidden lg:overflow-visible">
          {captures.length > 0 ? (
            <PeekStack captures={captures} countRef={countRef} />
          ) : (
            <SampleOffer />
          )}
        </div>

        {/* A FIXED line, always here: the way to Review, never a badge. Muted, never
            blue, and absent at zero, so it cannot read as something overdue. It
            reserves its height either way, so it cannot move anything. */}
        <div className="flex h-8 items-center justify-center lg:justify-start">
          {waiting > 0 && (
            <button type="button" className="tl-quiet-link" onClick={onOpenReview}>
              {waiting} waiting to sort
            </button>
          )}
        </div>
      </div>

      {sinking.map((s) => (
        <div
          key={s.id}
          aria-hidden
          className="tl-sink pointer-events-none absolute z-20"
          style={{
            left: s.left,
            top: s.top,
            width: s.width,
            height: s.clip + 12, // room for the 9px drop
            overflow: "hidden",
          }}
          onAnimationEnd={(event) => {
            if ((event.target as HTMLElement).dataset.last === undefined) return;
            setSinking((current) => current.filter((x) => x.id !== s.id));
          }}
        >
          <div style={{ marginTop: -s.scrolled }}>{renderSink(s.text)}</div>
        </div>
      ))}
    </section>
  );
}
