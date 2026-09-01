import { useEffect, useRef, useState } from "react";
import { Button, Chip, Field, FileCard, type FileTone } from "../components/ui";
import { parkCapture } from "../db";
import {
  formatDuration,
  isVoiceSupported,
  VoiceSession,
} from "../lib/voice";
import type { CaptureTag } from "../types";

interface CaptureViewProps {
  onParked: () => void;
}

const TAGS: { value: CaptureTag; label: string; tone: FileTone }[] = [
  { value: "now", label: "Now", tone: "now" },
  { value: "later", label: "Later", tone: "later" },
  { value: "?", label: "?", tone: "wonder" },
];

function tagTone(tag: CaptureTag | undefined): FileTone {
  if (tag === "now") return "now";
  if (tag === "later") return "later";
  if (tag === "?") return "wonder";
  return "neutral";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hapticPark(): void {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* some browsers expose vibrate but reject it */
  }
}

export function CaptureView({ onParked }: CaptureViewProps) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<CaptureTag | undefined>();
  const [status, setStatus] = useState<"idle" | "logged">("idle");
  const [filingTone, setFilingTone] = useState<FileTone | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const parkingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const sessionRef = useRef<VoiceSession | null>(null);
  const recordStartedAtRef = useRef(0);
  const voiceOk = isVoiceSupported();

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

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }

  function playLoggedMotion(parkedTag: CaptureTag | undefined) {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];

    setText("");
    setTag(undefined);
    onParked();
    inputRef.current?.focus();
    setStatus("logged");

    const skipSlide = prefersReducedMotion();
    if (skipSlide) {
      setFilingTone(null);
    } else {
      setFilingTone(tagTone(parkedTag));
      later(700, () => setFilingTone(null));
    }
    later(900, () => setStatus("idle"));
  }

  async function handlePark(event?: React.FormEvent) {
    event?.preventDefault();
    if (parkingRef.current || recording) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    parkingRef.current = true;
    const parkedTag = tag;
    hapticPark();

    try {
      await parkCapture(trimmed, parkedTag);
    } finally {
      parkingRef.current = false;
    }

    playLoggedMotion(parkedTag);
  }

  async function startRecording() {
    if (parkingRef.current || recording) return;
    setVoiceError(null);

    const session = new VoiceSession();
    try {
      await session.start();
    } catch (err) {
      session.dispose();
      setVoiceError(
        err instanceof Error
          ? err.message
          : "Could not start the microphone.",
      );
      return;
    }

    sessionRef.current = session;
    recordStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setRecording(true);
  }

  async function stopAndParkVoice() {
    if (parkingRef.current || !recording) return;
    const session = sessionRef.current;
    if (!session) return;

    parkingRef.current = true;
    setRecording(false);
    setVoiceError(null);
    const parkedTag = tag;
    hapticPark();

    try {
      const result = await session.stop();
      sessionRef.current = null;

      await parkCapture({
        text: result.text,
        tag: parkedTag,
        audioBlob: result.audioBlob,
        audioMimeType: result.audioMimeType,
        durationMs: result.durationMs,
        transcriptStatus: result.transcriptStatus,
      });

      playLoggedMotion(parkedTag);
    } catch (err) {
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setVoiceError(
        err instanceof Error ? err.message : "Could not park the recording.",
      );
    } finally {
      parkingRef.current = false;
      setElapsedMs(0);
    }
  }

  return (
    <section
      className="flex min-h-[calc(100dvh-5.5rem)] flex-col justify-center px-4 py-16"
      onClick={() => {
        if (!recording) inputRef.current?.focus();
      }}
    >
      <div className="flex flex-col gap-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium text-ink">What's pulling you?</h1>
          <p className="text-sm text-muted">Park it. Go back. No thinking here.</p>
        </header>

        <form
          onSubmit={(event) => void handlePark(event)}
          className="relative space-y-5"
          onClick={(event) => event.stopPropagation()}
        >
          <Field
            inputRef={inputRef}
            value={text}
            onChange={setText}
            placeholder={
              recording ? "Recording… stop when done" : "One line is enough"
            }
            autoComplete="off"
            enterKeyHint="done"
            maxLines={3}
            className="bg-raised py-4"
            disabled={recording}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handlePark();
              }
            }}
          />

          <div className="flex flex-wrap gap-2">
            {TAGS.map((option) => (
              <Chip
                key={option.value}
                tone={option.tone}
                selected={tag === option.value}
                onClick={() =>
                  setTag(tag === option.value ? undefined : option.value)
                }
              >
                {option.label}
              </Chip>
            ))}
          </div>

          {recording ? (
            <div className="flex flex-col gap-3">
              <p
                className="text-center text-sm text-ink"
                aria-live="polite"
              >
                Recording {formatDuration(elapsedMs)}
              </p>
              <Button
                type="button"
                fullWidth
                onClick={() => void stopAndParkVoice()}
              >
                Stop and park
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button type="submit" fullWidth disabled={!text.trim()}>
                Park
              </Button>
              {voiceOk ? (
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => void startRecording()}
                  aria-label="Start voice recording"
                >
                  Mic
                </Button>
              ) : (
                <p className="text-center text-sm text-muted">
                  Mic needs HTTPS (Vercel preview or localhost).
                </p>
              )}
            </div>
          )}

          {voiceError && (
            <p className="text-center text-sm text-ink" role="alert">
              {voiceError}
            </p>
          )}

          {filingTone && (
            <div className="pointer-events-none absolute inset-x-0 top-0 animate-file-into-stack">
              <FileCard tone={filingTone} peek />
            </div>
          )}
        </form>

        <div className="flex flex-col gap-6 pt-2">
          <p
            className="h-5 text-center text-sm text-do"
            aria-live="polite"
            aria-atomic="true"
          >
            {status === "logged" ? "Logged." : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
