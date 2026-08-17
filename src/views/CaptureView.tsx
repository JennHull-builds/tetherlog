import { useEffect, useRef, useState } from "react";
import { parkCapture } from "../db";
import type { CaptureTag } from "../types";

interface CaptureViewProps {
  onParked: () => void;
}

const TAGS: { value: CaptureTag; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "later", label: "Later" },
  { value: "?", label: "?" },
];

export function CaptureView({ onParked }: CaptureViewProps) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<CaptureTag | undefined>();
  const [status, setStatus] = useState<"idle" | "parked">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

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
    <section className="flex min-h-[70dvh] flex-col justify-center gap-6 px-4 py-8">
      <div>
        <p className="text-sm text-[var(--muted)]">Capture</p>
        <h1 className="mt-1 text-2xl font-medium">What's buzzing?</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Park it. Go back. No thinking here.
        </p>
      </div>

      <form onSubmit={handlePark} className="space-y-4">
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="One line is enough"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-4 text-lg outline-none focus:border-[var(--accent)]"
          autoComplete="off"
          enterKeyHint="done"
        />

        <div className="flex flex-wrap gap-2">
          {TAGS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setTag(tag === option.value ? undefined : option.value)
              }
              className={`rounded-full border px-3 py-1 text-sm ${
                tag === option.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!text.trim()}
          className="w-full rounded-2xl bg-[var(--accent)] px-4 py-4 text-base font-medium text-[#0f0f14] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Park
        </button>
      </form>

      {status === "parked" && (
        <p className="text-center text-sm text-[var(--do)]" aria-live="polite">
          Parked.
        </p>
      )}
    </section>
  );
}
