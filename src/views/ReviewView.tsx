import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, Chip, Field, FileCard } from "../components/ui";
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
        <p className="text-sm text-muted">Review</p>
        <h1 className="mt-1 text-2xl font-medium text-ink">Evening review</h1>
        <p className="mt-2 text-sm text-muted">
          Agent runs here — not at capture.
        </p>
      </div>

      <Card>
        <h2 className="font-medium text-ink">Wins</h2>
        <p className="mt-1 text-sm text-muted">What moved today?</p>
        <div className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1">
            <Field
              value={winDraft}
              onChange={setWinDraft}
              placeholder="Even tiny counts"
            />
          </div>
          <Button variant="ghost" onClick={addWin}>
            Add
          </Button>
        </div>
        {wins.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-ink">
            {wins.map((win) => (
              <li key={win}>• {win}</li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium text-ink">
            Today's captures ({untriagedToday.length} open)
          </h2>
          <Button
            onClick={runReview}
            disabled={loading || untriagedToday.length === 0}
            className="shrink-0 py-2"
          >
            {loading ? "Reviewing…" : settings?.geminiApiKey ? "AI triage" : "Rule triage"}
          </Button>
        </div>

        {!settings?.geminiApiKey && (
          <p className="text-sm text-muted">
            No API key — using rule-based triage. Add your Gemini key in Settings for AI.
          </p>
        )}

        {error && <p className="text-sm text-ink">{error}</p>}

        {suggestions.map((suggestion) => {
          const capture = untriagedToday.find(
            (item) => item.id === suggestion.captureId,
          );
          if (!capture) return null;

          return (
            <FileCard key={suggestion.captureId} tone={suggestion.bucket}>
              <p className="font-medium text-ink">{capture.text}</p>
              <p className="mt-2 text-sm text-muted">{suggestion.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip
                  selected
                  tone={suggestion.bucket}
                  onClick={() => confirmSuggestion(suggestion)}
                >
                  {BUCKET_LABELS[suggestion.bucket]}
                </Chip>
                {(["do", "later", "drop", "wonder"] as TriageBucket[]).map(
                  (bucket) => (
                    <Chip
                      key={bucket}
                      tone={bucket}
                      onClick={() => overrideBucket(capture.id, bucket)}
                    >
                      {BUCKET_LABELS[bucket]}
                    </Chip>
                  ),
                )}
              </div>
            </FileCard>
          );
        })}
      </div>

      {triagedToday.length > 0 && (
        <Card className="no-print">
          <h2 className="font-medium text-ink">Hands</h2>
          <p className="mt-1 text-sm text-muted">
            Export your do items — no paid integrations.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" className="py-2" onClick={() => void copyDoList()}>
              Copy do list
            </Button>
            <Button
              variant="ghost"
              className="py-2"
              onClick={() =>
                void copyText(formatReviewMarkdown(dayKey, triagedToday, wins))
              }
            >
              Copy review
            </Button>
            <Button
              variant="ghost"
              className="py-2"
              onClick={() =>
                downloadFile(
                  `tetherlog-${dayKey}.ics`,
                  buildIcsForDoItems(triagedToday),
                  "text/calendar",
                )
              }
            >
              Download .ics
            </Button>
            <Button
              variant="ghost"
              className="py-2"
              onClick={() => mailtoDoList(triagedToday)}
            >
              Email do list
            </Button>
            <Button
              variant="ghost"
              className="py-2"
              onClick={() =>
                void shareText("TetherLog review", formatDoList(triagedToday))
              }
            >
              Share
            </Button>
            <Button variant="ghost" className="py-2" onClick={() => window.print()}>
              Print
            </Button>
          </div>
          {doCaptures.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-ink">
              {doCaptures.map((item) => (
                <li key={item.id}>• {item.text}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </section>
  );
}
