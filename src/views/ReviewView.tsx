import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, Chip, Field, FileCard } from "../components/ui";
import {
  addWin,
  applyTriage,
  getCapturesForDay,
  getSettings,
  getUntriagedCaptures,
  getWinsForDay,
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
import type { Capture, TriageBucket, TriageSuggestion } from "../types";
import { BUCKET_LABELS, todayKey } from "../types";

export function ReviewView() {
  const dayKey = todayKey();
  const captures =
    useLiveQuery(() => getCapturesForDay(dayKey), [dayKey], []) ?? [];
  const backlog =
    useLiveQuery(() => getUntriagedCaptures(), [], []) ?? [];
  const wins = useLiveQuery(() => getWinsForDay(dayKey), [dayKey], []) ?? [];
  const settings = useLiveQuery(getSettings, [], null);

  const [winDraft, setWinDraft] = useState("");
  const [includeBacklog, setIncludeBacklog] = useState(false);
  const [suggestions, setSuggestions] = useState<TriageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedAi, setUsedAi] = useState(false);

  const untriagedToday = useMemo(
    () => captures.filter((capture) => !capture.triagedAt),
    [captures],
  );

  const olderBacklog = useMemo(() => {
    const todayIds = new Set(untriagedToday.map((c) => c.id));
    return backlog.filter((c) => !todayIds.has(c.id));
  }, [backlog, untriagedToday]);

  const queue: Capture[] = useMemo(() => {
    if (!includeBacklog) return untriagedToday;
    // Today first, then older untriaged.
    return [...untriagedToday, ...olderBacklog];
  }, [includeBacklog, untriagedToday, olderBacklog]);

  const suggestionCaptures = useMemo(() => {
    const byId = new Map(queue.map((c) => [c.id, c]));
    // Keep text for suggestions even if live query refreshes mid-confirm.
    for (const c of backlog) byId.set(c.id, c);
    for (const c of captures) byId.set(c.id, c);
    return byId;
  }, [queue, backlog, captures]);

  async function runReview() {
    if (queue.length === 0) return;

    setLoading(true);
    setError(null);
    setUsedAi(false);

    const hasKey = Boolean(settings?.geminiApiKey);

    try {
      if (hasKey) {
        const batch = await aiTriageWithGemini(settings!.geminiApiKey!, queue);
        setSuggestions(batch.items);
        setUsedAi(true);
      } else {
        setSuggestions(ruleBasedTriage(queue).items);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — fell back to rule triage.`
          : "AI triage failed — fell back to rule triage.",
      );
      setSuggestions(ruleBasedTriage(queue).items);
      setUsedAi(false);
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

  const triagedToday =
    useLiveQuery(async () => {
      const all = await getCapturesForDay(dayKey);
      return all.filter((capture) => capture.triagedAt);
    }, [dayKey], []) ?? [];

  const doCaptures = triagedToday.filter((c) => c.bucket === "do");

  const summaryCounts = useMemo(() => {
    const counts = { do: 0, later: 0, drop: 0, wonder: 0 };
    for (const capture of triagedToday) {
      if (capture.bucket) counts[capture.bucket] += 1;
    }
    return counts;
  }, [triagedToday]);

  const carryForward = triagedToday.find((c) => c.carryForward);

  async function handleAddWin() {
    const trimmed = winDraft.trim();
    if (!trimmed) return;
    await addWin(trimmed, dayKey);
    setWinDraft("");
  }

  async function copyDoList() {
    await copyText(formatDoList(triagedToday));
  }

  const winTexts = wins.map((w) => w.text);

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
          <Button variant="ghost" onClick={() => void handleAddWin()}>
            Add
          </Button>
        </div>
        {wins.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-ink">
            {wins.map((win) => (
              <li key={win.id}>• {win.text}</li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-ink">
            Captures ({queue.length} open
            {includeBacklog && olderBacklog.length > 0
              ? ` · ${olderBacklog.length} backlog`
              : ""}
            )
          </h2>
          <Button
            onClick={() => void runReview()}
            disabled={loading || queue.length === 0}
            className="shrink-0 py-2"
          >
            {loading
              ? "Reviewing…"
              : settings?.geminiApiKey
                ? "AI triage"
                : "Rule triage"}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={includeBacklog}
            onChange={(event) => setIncludeBacklog(event.target.checked)}
          />
          Include untriaged backlog
          {olderBacklog.length > 0 && (
            <span className="text-muted">({olderBacklog.length})</span>
          )}
        </label>

        {!settings?.geminiApiKey && (
          <p className="text-sm text-muted">
            No API key — using rule-based triage. Add your Gemini key in Settings
            for AI. Capture and review still work without it.
          </p>
        )}

        {error && <p className="text-sm text-ink">{error}</p>}
        {usedAi && !error && suggestions.length > 0 && (
          <p className="text-sm text-muted">Suggestions from your Gemini key (on this device).</p>
        )}

        {suggestions.map((suggestion) => {
          const capture = suggestionCaptures.get(suggestion.captureId);
          if (!capture) return null;

          return (
            <FileCard key={suggestion.captureId} tone={suggestion.bucket}>
              <p className="font-medium text-ink">{capture.text}</p>
              <p className="mt-2 text-sm text-muted">{suggestion.reason}</p>
              {suggestion.suggestedAction && (
                <p className="mt-1 text-sm text-muted">{suggestion.suggestedAction}</p>
              )}
              {suggestion.carryForward && (
                <p className="mt-1 text-sm text-do">Carry forward (max one)</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip
                  selected
                  tone={suggestion.bucket}
                  onClick={() => void confirmSuggestion(suggestion)}
                >
                  Confirm {BUCKET_LABELS[suggestion.bucket]}
                </Chip>
                {(["do", "later", "drop", "wonder"] as TriageBucket[]).map(
                  (bucket) => (
                    <Chip
                      key={bucket}
                      tone={bucket}
                      onClick={() => void overrideBucket(capture.id, bucket)}
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
        <Card>
          <h2 className="font-medium text-ink">Review summary</h2>
          <p className="mt-3 flex flex-wrap gap-3 text-sm text-ink">
            <span>Do {summaryCounts.do}</span>
            <span>Later {summaryCounts.later}</span>
            <span>Drop {summaryCounts.drop}</span>
            <span>Wonder {summaryCounts.wonder}</span>
          </p>
          {carryForward ? (
            <p className="mt-3 text-sm text-ink">
              Carry forward: {carryForward.text}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">No carry-forward chosen tonight.</p>
          )}
        </Card>
      )}

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
                void copyText(formatReviewMarkdown(dayKey, triagedToday, winTexts))
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
