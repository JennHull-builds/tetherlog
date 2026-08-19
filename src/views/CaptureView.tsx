import { useEffect, useRef, useState } from "react";
import { LogStack } from "../components/LogStack";
import { Button, Chip, Field } from "../components/ui";
import { parkCapture } from "../db";
import type { CaptureTag } from "../types";

interface CaptureViewProps {
  onParked: () => void;
}

const TAGS: { value: CaptureTag; label: string; tone: "now" | "later" | "wonder" }[] =
  [
    { value: "now", label: "Now", tone: "now" },
    { value: "later", label: "Later", tone: "later" },
    { value: "?", label: "?", tone: "wonder" },
  ];

export function CaptureView({ onParked }: CaptureViewProps) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<CaptureTag | undefined>();
  const [status, setStatus] = useState<"idle" | "parked">("idle");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handlePark(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    await parkCapture(trimmed, tag);
    setText("");
    setTag(undefined);
    setStatus("parked");
    onParked();

    window.setTimeout(() => {
      setStatus("idle");
      inputRef.current?.focus();
    }, 900);
  }

  return (
    <section className="relative flex min-h-[70dvh] flex-col justify-center gap-6 overflow-hidden px-4 py-8">
      <LogStack className="pointer-events-none absolute inset-x-0 bottom-8 opacity-70" />

      <div className="relative z-10">
        <p className="text-sm text-muted">Capture</p>
        <h1 className="mt-1 text-2xl font-medium text-ink">What's buzzing?</h1>
        <p className="mt-2 text-sm text-muted">Park it. Go back. No thinking here.</p>
      </div>

      <form onSubmit={handlePark} className="relative z-10 space-y-4">
        <Field
          inputRef={inputRef}
          value={text}
          onChange={setText}
          placeholder="One line is enough"
          autoComplete="off"
          enterKeyHint="done"
          className="bg-raised py-4 text-lg"
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
      </form>

      {status === "parked" && (
        <p className="relative z-10 text-center text-sm text-do" aria-live="polite">
          Logged.
        </p>
      )}
    </section>
  );
}
