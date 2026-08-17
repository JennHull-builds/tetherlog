import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  applyTriage,
  getCapturesForDay,
  getSettings,
} from "../db";
import { aiTriageWithGemini, ruleBasedTriage } from "../lib/agent";
import {
  copyText,
  downloadFile,
  formatDoList,
  formatReviewMarkdown,
  buildIcsForDoItems,
  mailtoDoList,
  shareText,
} from "../lib/hands";
import type { TriageBucket, TriageSuggestion } from "../types";
import { BUCKET_LABELS, todayKey } from "../types";

export function ReviewView() {
  const dayKey = todayKey();
  const captures = useLiveQuery(() => getCapturesForDay(dayKey), [dayKey], []);
  const settings = useLiveQuery(getSettings, [], null);

  const [wins, setWins] = useState<string[]>([]);
  const [winDraft, setWinDraft] = useState("");
  const [suggestions, setSuggestions] = useState<TriageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const untriagedToday = useMemo(
    () => captures.filter((capture) => !capture.triagedAt),
    [captures],
  );

  async function runReview() {
    if (untriagedToday.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const batch = settings?.geminiApiKey
        ? await aiTriageWithGemini(settings.geminiApiKey, untriagedToday)
        : ruleBasedTriage(untriagedToday);

      setSuggestions(batch.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
      setSuggestions(ruleBasedTriage(untriagedToday).items);
    } finally {
      setLoading(false);
    }
  }

  async function confirmSuggestion(suggestion: TriageSuggestion) {
    await applyTriage(
      suggestion.captureId,
      suggestion.bucket,
      suggestion.reason,
      suggestion.suggestedAction,
      suggestion.carryForward,
    );

    setSuggestions((prev) =>
      prev.filter((item) => item.captureId !== suggestion.captureId),
    );
  }

  async function overrideBucket(captureId: string, bucket: TriageBucket) {
    await applyTriage(captureId, bucket, "You chose this bucket.", undefined, false);
    setSuggestions((prev) => prev.filter((item) => item.captureId !== captureId));
  }

  const triagedToday = useLiveQuery(async () => {
    const all = await getCapturesForDay(dayKey);
    return all.filter((capture) => capture.triagedAt);
  }, [dayKey], []);

  const doCaptures = triagedToday.filter((c) => c.bucket === "do");

  function addWin() {
    const trimmed = winDraft.trim();
    if (!trimmed) return;
    setWins((prev) => [...prev, trimmed]);
    setWinDraft("");
  }

  async function copyDoList() {
    await copyText(formatDoList(triagedToday));
  }

  return (
    <section className="space-y-6 px-4 py-8 print:block">
      <div>
        <p className="text-sm text-[var(--muted)]">Review</p>
        <h1 className="mt-1 text-2xl font-medium">Evening review</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Agent runs here — not at capture.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
        <h2 className="font-medium">Wins</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">What moved today?</p>
        <div className="mt-3 flex gap-2">
          <input
            value={winDraft}
            onChange={(event) => setWinDraft(event.target.value)}
            placeholder="Even tiny counts"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 outline-none"
          />
          <button
            type="button"
            onClick={addWin}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          >
            Add
          </button>
        </div>
        {wins.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {wins.map((win) => (
              <li key={win}>• {win}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Today's captures ({untriagedToday.length} open)</h2>
          <button
            type="button"
            onClick={runReview}
            disabled={loading || untriagedToday.length === 0}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#0f0f14] disabled:opacity-40"
          >
            {loading ? "Reviewing…" : settings?.geminiApiKey ? "AI triage" : "Rule triage"}
          </button>
        </div>

        {!settings?.geminiApiKey && (
          <p className="text-sm text-[var(--muted)]">
            No API key — using rule-based triage. Add your Gemini key in Settings for AI.
          </p>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        {suggestions.map((suggestion) => {
          const capture = untriagedToday.find(
            (item) => item.id === suggestion.captureId,
          );
          if (!capture) return null;

          return (
            <article
              key={suggestion.captureId}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4"
            >
              <p className="font-medium">{capture.text}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{suggestion.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => confirmSuggestion(suggestion)}
                  className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm text-[#0f0f14]"
                >
                  {BUCKET_LABELS[suggestion.bucket]}
                </button>
                {(["do", "later", "drop", "wonder"] as TriageBucket[]).map(
                  (bucket) => (
                    <button
                      key={bucket}
                      type="button"
                      onClick={() => overrideBucket(capture.id, bucket)}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                    >
                      {BUCKET_LABELS[bucket]}
                    </button>
                  ),
                )}
              </div>
            </article>
          );
        })}
      </div>

      {triagedToday.length > 0 && (
        <div className="no-print rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <h2 className="font-medium">Hands</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Export your do items — no paid integrations.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <HandButton label="Copy do list" onClick={copyDoList} />
            <HandButton
              label="Copy review"
              onClick={() =>
                copyText(formatReviewMarkdown(dayKey, triagedToday, wins))
              }
            />
            <HandButton
              label="Download .ics"
              onClick={() =>
                downloadFile(
                  `tetherlog-${dayKey}.ics`,
                  buildIcsForDoItems(triagedToday),
                  "text/calendar",
                )
              }
            />
            <HandButton label="Email do list" onClick={() => mailtoDoList(triagedToday)} />
            <HandButton
              label="Share"
              onClick={async () => {
                await shareText("TetherLog review", formatDoList(triagedToday));
              }}
            />
            <HandButton label="Print" onClick={() => window.print()} />
          </div>
          {doCaptures.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {doCaptures.map((item) => (
                <li key={item.id}>• {item.text}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function HandButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
    >
      {label}
    </button>
  );
}
