import { useEffect, useRef, useState } from "react";
import { LogStack } from "../components/LogStack";
import { Button, Chip, Field, FileCard, type FileTone } from "../components/ui";
import { parkCapture } from "../db";
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
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const parkingRef = useRef(false);
  const timersRef = useRef<number[]>([]);

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
    };
  }, []);

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }

  async function handlePark(event?: React.FormEvent) {
    event?.preventDefault();
    if (parkingRef.current) return;

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

  return (
    <section
      className="relative flex min-h-[calc(100dvh-5.5rem)] flex-col justify-center overflow-hidden px-4 py-8"
      onClick={() => inputRef.current?.focus()}
    >
      <LogStack className="pointer-events-none absolute inset-x-0 top-[58%] z-0 opacity-80" />

      <div className="relative z-10 space-y-6">
        <h1 className="text-2xl font-medium text-ink">What's buzzing?</h1>

        <form
          onSubmit={(event) => void handlePark(event)}
          className="relative space-y-4"
          onClick={(event) => event.stopPropagation()}
        >
          <Field
            inputRef={inputRef}
            value={text}
            onChange={setText}
            placeholder="One line is enough"
            autoComplete="off"
            enterKeyHint="done"
            maxLines={3}
            className="bg-raised py-4"
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

          <Button type="submit" fullWidth disabled={!text.trim()}>
            Park
          </Button>

          {filingTone && (
            <div className="pointer-events-none absolute inset-x-0 top-0 animate-file-into-stack">
              <FileCard tone={filingTone} peek />
            </div>
          )}
        </form>

        <p
          className="h-5 text-center text-sm text-do"
          aria-live="polite"
          aria-atomic="true"
        >
          {status === "logged" ? "Logged." : ""}
        </p>
      </div>
    </section>
  );
}
