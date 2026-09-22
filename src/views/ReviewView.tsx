import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Chip, Field, TriageCard, TriagePeek } from "../components/ui";
import type { BucketTone } from "../components/ui";
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
import { readDurationMs } from "../lib/motion";
import { formatDuration } from "../lib/voice";
import type { Capture, TriageBucket, TriageSuggestion, Win } from "../types";
import { BUCKET_LABELS, VOICE_TEXT_PLACEHOLDER, todayKey } from "../types";

/**
 * Review, in two states. See docs/DECISIONS.md D-017 for the structure and
 * D-018 for the two questions D-017 left open.
 *
 * TRIAGE, then WRAP-UP. Review opens straight into the queue: one thought
 * filling the view, nothing else on screen. Wins, the summary, the backlog and
 * Hands do not exist until the queue is empty.
 *
 * THE HAND-OFF IS NOT A MOMENT. The last card leaves on --ease-dismiss like
 * every other card and the wrap-up rises on --ease-settle in the space the
 * next card would have used. There is no bespoke transition and no light
 * event: the one light event in the app belongs to Capture's commit, and a
 * flourish for finishing is a celebration, which PRODUCT.md forbids. The queue
 * is derived from the database, so "the last card" is not a state this code
 * knows in advance — it is simply the moment nothing is left.
 *
 * LEAVING MID-RITUAL COSTS NOTHING, which is why the navigation stays on both
 * states. Every confirmed card is already written and the queue re-derives
 * itself on return.
 */

const NO_CAPTURES: Capture[] = [];
const NO_WINS: Win[] = [];

const BUCKETS: TriageBucket[] = ["do", "later", "drop", "wonder"];

function timeLabel(createdAt: number): string {
  // hour12 false, explicitly: UK English, and the AM/PM suffix is two
  // characters of machine output competing with the bucket for the header.
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const DOT_TONE: Record<TriageBucket, string> = {
  do: "var(--color-do)",
  later: "var(--color-tag-later)",
  drop: "var(--color-drop)",
  wonder: "var(--color-tag-wonder)",
};

/** The type size a marker is sitting beside, so it lands on the first line. */
const DOT_LINE: Record<"body" | "small" | "none", string | undefined> = {
  body: "calc(var(--tl-text-body) * var(--tl-leading-body))",
  small: "calc(var(--tl-text-small) * var(--tl-leading-body))",
  none: undefined,
};

/**
 * A bucket hue as a marker beside words, never as the words themselves.
 *
 * It centres itself in a box exactly one line tall, so it sits on the FIRST
 * line of whatever it labels rather than drifting to the middle of a two-line
 * sentence: the carry-forward line wraps as soon as a thought is longer than a
 * few words, which is most of them. `line` has to name the size it is sitting
 * beside, because the box cannot read the type size of its own parent. `none`
 * is for a single-line row that centres its own children.
 */
function BucketDot({
  bucket,
  line = "body",
}: {
  bucket: TriageBucket;
  line?: "body" | "small" | "none";
}) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center"
      style={{ height: DOT_LINE[line] }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "var(--tl-radius-full)",
          background: DOT_TONE[bucket],
        }}
      />
    </span>
  );
}

interface CaptureAudioProps {
  blob: Blob;
  durationMs?: number;
}

function CaptureAudio({ blob, durationMs }: CaptureAudioProps) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="mt-3 space-y-1">
      <audio controls src={url} preload="metadata" className="w-full" />
      {typeof durationMs === "number" && durationMs > 0 && (
        <p className="font-mono text-micro tracking-micro text-muted">
          {formatDuration(durationMs)}
        </p>
      )}
    </div>
  );
}

/** A card on its way out, pinned to the rect it occupied. */
interface Leaving {
  id: string;
  rect: { top: number; left: number; width: number; height: number };
  node: ReactNode;
}

export function ReviewView() {
  const dayKey = todayKey();
  const captures = useLiveQuery(
    () => getCapturesForDay(dayKey),
    [dayKey],
    NO_CAPTURES,
  );
  const backlog = useLiveQuery(() => getUntriagedCaptures(), [], NO_CAPTURES);
  const wins = useLiveQuery(() => getWinsForDay(dayKey), [dayKey], NO_WINS);
  const settings = useLiveQuery(getSettings, [], null);

  const [includeBacklog, setIncludeBacklog] = useState(false);
  const [aiById, setAiById] = useState<Map<string, TriageSuggestion> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  const [leaving, setLeaving] = useState<Leaving[]>([]);

  const slotRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const timersRef = useRef<number[]>([]);
  /** Focus follows the queue only after the person has confirmed something. */
  const confirmCountRef = useRef(0);
  const focusedIdRef = useRef<string | null>(null);

  useEffect(() => {
    // The array identity never changes, only its contents, so holding it here
    // is the same list the handlers push onto.
    const timers = timersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  const untriagedToday = useMemo(
    () => captures.filter((capture) => !capture.triagedAt),
    [captures],
  );

  const olderBacklog = useMemo(() => {
    const todayIds = new Set(untriagedToday.map((c) => c.id));
    return backlog.filter((c) => !todayIds.has(c.id));
  }, [backlog, untriagedToday]);

  const untriaged = useMemo(
    () => (includeBacklog ? [...untriagedToday, ...olderBacklog] : untriagedToday),
    [includeBacklog, untriagedToday, olderBacklog],
  );

  /**
   * THE RITUAL SET, APPEND-ONLY. Suggestions are derived from this rather than
   * from the live queue, and the difference is not cosmetic: `ruleBasedTriage`
   * grants carry-forward to the FIRST `do` in the array it is handed, so
   * re-running it against a queue that shrinks with every confirm moves the
   * flag to the next `do` and offers "carry forward (max one)" on three
   * separate cards. Appending never moves the first `do`.
   */
  const [ritual, setRitual] = useState<Capture[]>([]);
  const unseen = untriaged.filter(
    (capture) => !ritual.some((item) => item.id === capture.id),
  );
  if (unseen.length > 0) {
    // Adjusting state during render, React's documented pattern for syncing to
    // a changed source. It converges: after this, `unseen` is empty.
    setRitual([...ritual, ...unseen]);
  }

  const ruleById = useMemo(() => {
    const batch = ruleBasedTriage(ritual);
    return new Map(batch.items.map((item) => [item.captureId, item]));
  }, [ritual]);

  const untriagedIds = useMemo(
    () => new Set(untriaged.map((capture) => capture.id)),
    [untriaged],
  );

  const queue = useMemo(
    () =>
      ritual.filter(
        (capture) => untriagedIds.has(capture.id) && !confirmed.has(capture.id),
      ),
    [ritual, untriagedIds, confirmed],
  );

  const triagedToday = useMemo(
    () => captures.filter((capture) => capture.triagedAt),
    [captures],
  );

  /** Max one carry-forward. Once one is taken tonight, no card offers another. */
  const carryTaken = triagedToday.some((capture) => capture.carryForward);

  const current = queue[0];
  const next = queue[1];
  const done = ritual.filter(
    (capture) => !untriagedIds.has(capture.id) || confirmed.has(capture.id),
  ).length;

  function suggestionFor(capture: Capture): TriageSuggestion {
    const found = aiById?.get(capture.id) ?? ruleById.get(capture.id);
    const base: TriageSuggestion = found ?? {
      captureId: capture.id,
      bucket: "later",
      reason: "Parked for later. Review when you have space.",
      carryForward: false,
    };
    return carryTaken ? { ...base, carryForward: false } : base;
  }

  /** The card leaves on its own timer, keyed by capture id, so two confirms
   *  in a row animate two different elements and the second never queues. */
  function startLeaving(id: string, node: ReactNode) {
    const rect = slotRef.current?.getBoundingClientRect();
    if (!rect) return;

    setLeaving((prev) => [
      ...prev,
      {
        id,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        node,
      },
    ]);

    const ms = readDurationMs("--tl-spring-dismiss-duration", 200);
    const timer = window.setTimeout(() => {
      setLeaving((prev) => prev.filter((item) => item.id !== id));
    }, ms + 40);
    timersRef.current.push(timer);
  }

  /**
   * Optimistic, like the park, but the stakes are lower: the thought is
   * already saved and only the decision is in flight, so the recovery is to
   * put the card back rather than to hand words back to a text field.
   */
  function confirm(
    capture: Capture,
    bucket: TriageBucket,
    suggestion: TriageSuggestion,
    node: ReactNode,
  ) {
    const chosen = bucket === suggestion.bucket;
    startLeaving(capture.id, node);
    setConfirmed((prev) => new Set(prev).add(capture.id));
    setStatus(null);
    confirmCountRef.current += 1;

    void applyTriage(
      capture.id,
      bucket,
      chosen ? suggestion.reason : "You chose this bucket.",
      chosen ? suggestion.suggestedAction : undefined,
      chosen ? suggestion.carryForward && !carryTaken : false,
    ).catch((error: unknown) => {
      console.warn("[tetherlog] triage failed for", capture.id, error);
      setConfirmed((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(capture.id);
        return nextSet;
      });
      setStatus("That one did not save. It is back in the queue.");
    });
  }

  async function runReview() {
    if (queue.length === 0 || !settings?.geminiApiKey) return;

    setLoading(true);
    setStatus(null);

    try {
      const batch = await aiTriageWithGemini(settings.geminiApiKey, queue);
      setAiById(new Map(batch.items.map((item) => [item.captureId, item])));
      setStatus("Suggestions from your Gemini key (on this device).");
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `${err.message} Fell back to rule triage.`
          : "AI triage failed. Fell back to rule triage.",
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * Focus follows the queue, but only once something has been confirmed, so
   * arriving at Review never steals focus. It lands on the card rather than on
   * Confirm: the card names itself with the thought and the bucket, which is
   * what a screen reader needs to hear before it is asked to agree.
   */
  useEffect(() => {
    if (!current) return;
    if (confirmCountRef.current === 0) return;
    if (focusedIdRef.current === current.id) return;
    focusedIdRef.current = current.id;
    cardRef.current?.focus();
  }, [current]);

  const ghosts = leaving.map((item) => (
    <div
      key={item.id}
      aria-hidden
      className="tl-triage-leaving"
      style={{
        position: "fixed",
        top: item.rect.top,
        left: item.rect.left,
        width: item.rect.width,
        height: item.rect.height,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {item.node}
    </div>
  ));

  return (
    <>
      {current ? (
        <TriageState
          capture={current}
          suggestion={suggestionFor(current)}
          next={next}
          position={done + 1}
          total={done + queue.length}
          status={status}
          loading={loading}
          hasKey={Boolean(settings?.geminiApiKey)}
          slotRef={slotRef}
          cardRef={cardRef}
          onAskAgent={() => void runReview()}
          onConfirm={confirm}
        />
      ) : (
        <WrapUp
          dayKey={dayKey}
          triagedToday={triagedToday}
          wins={wins}
          backlogCount={olderBacklog.length}
          includeBacklog={includeBacklog}
          onIncludeBacklog={() => setIncludeBacklog(true)}
          hasKey={Boolean(settings?.geminiApiKey)}
        />
      )}
      {ghosts}
    </>
  );
}

// ── the triage state ────────────────────────────────────────────────────────

interface TriageStateProps {
  capture: Capture;
  suggestion: TriageSuggestion;
  next?: Capture;
  position: number;
  total: number;
  status: string | null;
  loading: boolean;
  hasKey: boolean;
  slotRef: React.RefObject<HTMLDivElement | null>;
  cardRef: React.RefObject<HTMLElement | null>;
  onAskAgent: () => void;
  onConfirm: (
    capture: Capture,
    bucket: TriageBucket,
    suggestion: TriageSuggestion,
    node: ReactNode,
  ) => void;
}

/**
 * One thought, filling the view, and nothing else.
 *
 * THREE FIXED SLOTS, and the card between them never moves: the header (the
 * position, the agent control and ONE reserved status line), the card itself,
 * and the peek slot at the fold. The status line and the peek are always
 * present whether or not they have anything in them. Capture learned this the
 * expensive way — its field rose 66px the first time anything was parked,
 * because a conditional block above it changed height. See D-014.
 */
function TriageState({
  capture,
  suggestion,
  next,
  position,
  total,
  status,
  loading,
  hasKey,
  slotRef,
  cardRef,
  onAskAgent,
  onConfirm,
}: TriageStateProps) {
  const bucket = suggestion.bucket;
  const overrides = BUCKETS.filter((item) => item !== bucket);

  /**
   * Built per id prefix rather than once, so the ghost copy below never
   * duplicates the live card's element ids. They coexist for 200ms whenever a
   * confirm fails and puts its card back, and two elements answering to the
   * same `aria-labelledby` target is a card that names itself with somebody
   * else's thought.
   */
  const renderBody = (prefix: string) => (
    <>
      {/*
        THE THOUGHT IS THIS SCREEN'S HEADLINE, so it is set at the display
        step. docs/BUILD-SPEC.md's Review blueprint said --text-lg, which was
        a Depth Field size and does not exist in the live five-step scale; that
        section is marked superseded for exactly this reason. Nothing else on
        the triage state uses the display step, so the one-headline-per-screen
        rule holds and the headline is the one thing the screen is about.
        See docs/DECISIONS.md D-018.
      */}
      <p
        id={`${prefix}-text`}
        className="text-display font-light leading-display tracking-display text-ink"
      >
        {capture.text}
      </p>
      {capture.audioBlob && capture.text === VOICE_TEXT_PLACEHOLDER && (
        <p className="mt-2 text-small text-muted">No transcript yet</p>
      )}
      {capture.audioBlob && (
        <CaptureAudio blob={capture.audioBlob} durationMs={capture.durationMs} />
      )}
      <p className="mt-3 text-small text-muted">{suggestion.reason}</p>
      {suggestion.suggestedAction && (
        <p className="mt-1 text-small text-muted">{suggestion.suggestedAction}</p>
      )}
      {suggestion.carryForward && (
        // The fix docs/BUILD-SPEC.md asked for: this was `text-do` at 2.79:1,
        // with the colour carrying the whole meaning. Ink plus a marker.
        <p className="mt-3 flex items-start gap-2 text-small text-ink">
          <BucketDot bucket="do" line="small" />
          <span>Carry forward (max one)</span>
        </p>
      )}
    </>
  );

  /**
   * The card as it looks right now, captured so the ghost can keep showing it
   * for the 200ms it takes to leave. Built without the ref: a second copy
   * holding the same ref would clobber what the focus effect reads.
   */
  const ghostNode = (
    <TriageCard
      tone={bucket as BucketTone}
      label={BUCKET_LABELS[bucket]}
      time={timeLabel(capture.createdAt)}
      domId={`ghost-${capture.id}`}
    >
      {renderBody(`ghost-${capture.id}`)}
    </TriageCard>
  );

  return (
    <section
      className="flex flex-col"
      style={{
        paddingInline: "var(--tl-gutter)",
        paddingBlock: "var(--tl-space-md)",
        height: "calc(100dvh - 5.5rem)",
      }}
    >
      <header className="shrink-0">
        <div className="flex h-9 items-center justify-between gap-3">
          <p className="font-mono text-micro tracking-micro text-muted" role="status">
            {position} of {total}
          </p>
          {hasKey && (
            <Button
              variant="ghost"
              className="py-1"
              disabled={loading}
              onClick={onAskAgent}
            >
              {loading ? "Reviewing…" : "AI triage"}
            </Button>
          )}
        </div>
        {/* ONE reserved line, three jobs: empty, the agent's provenance, or a
            failure. Always this tall, so the card below it cannot move. */}
        <div className="flex h-8 items-center">
          <p className="text-small text-muted" role="status">
            {status ?? ""}
          </p>
        </div>
      </header>

      {/*
        THE CARD FILLS THE VIEW. Not a list, and not a floating panel either: a
        card capped to a fixed height and centred was tried, and at 390 it left
        a band of bare ground above and below and read as an item on a page
        rather than as the page. The emptiness inside a tall card is answered by
        centring the thought within it, not by shrinking the card.

        z-index, because the card has to paint over the peek tucked beneath it.
        Occlusion is the first of the three depth cues and it needs the card in
        front to exist at all.
      */}
      <div ref={slotRef} className="relative z-10 min-h-0 flex-1">
        <div key={capture.id} className="tl-triage-rising h-full">
          <TriageCard
            cardRef={cardRef}
            tone={bucket as BucketTone}
            label={BUCKET_LABELS[bucket]}
            time={timeLabel(capture.createdAt)}
            domId={`triage-${capture.id}`}
            footer={
              <div className="space-y-3">
                <Button
                  fullWidth
                  onClick={() => onConfirm(capture, bucket, suggestion, ghostNode)}
                >
                  Confirm {BUCKET_LABELS[bucket]}
                </Button>
                <div className="flex flex-wrap gap-2">
                  {overrides.map((item) => (
                    <Chip
                      key={item}
                      tone={item}
                      onClick={() => onConfirm(capture, item, suggestion, ghostNode)}
                    >
                      {BUCKET_LABELS[item]}
                    </Chip>
                  ))}
                </div>
              </div>
            }
          >
            {renderBody(`triage-${capture.id}`)}
          </TriageCard>
        </div>
      </div>

      {/* The fold. A fixed slot whether or not there is a next thought, so the
          card is the same height on the first card and on the last one. */}
      <div className="relative h-10 shrink-0 overflow-hidden">
        {next && <TriagePeek text={next.text} />}
      </div>
    </section>
  );
}

// ── the wrap-up state ───────────────────────────────────────────────────────

interface WrapUpProps {
  dayKey: string;
  triagedToday: Capture[];
  wins: Win[];
  backlogCount: number;
  includeBacklog: boolean;
  onIncludeBacklog: () => void;
  hasKey: boolean;
}

/**
 * What the ritual produced, and the ways out of it.
 *
 * SPACE, NOT CARDS. The sections are separated by space and named in the body
 * face. A rule between them would have to be --tl-hairline, which measures
 * 1.08:1 to 1.15:1 on these surfaces and is not faint but invisible, and the
 * structural rule token is for boundaries a user has to see, not for grouping.
 *
 * IT RISES ON THE SAME SPRING A CARD DOES. The hand-off from the last card is
 * deliberately not a moment of its own. See docs/DECISIONS.md D-018.
 */
function WrapUp({
  dayKey,
  triagedToday,
  wins,
  backlogCount,
  includeBacklog,
  onIncludeBacklog,
  hasKey,
}: WrapUpProps) {
  const [winDraft, setWinDraft] = useState("");

  const counts = useMemo(() => {
    const totals = { do: 0, later: 0, drop: 0, wonder: 0 };
    for (const capture of triagedToday) {
      if (capture.bucket) totals[capture.bucket] += 1;
    }
    return totals;
  }, [triagedToday]);

  const carryForward = triagedToday.find((capture) => capture.carryForward);
  const doCaptures = triagedToday.filter((capture) => capture.bucket === "do");
  const winTexts = wins.map((win) => win.text);

  async function handleAddWin() {
    const trimmed = winDraft.trim();
    if (!trimmed) return;
    setWinDraft("");
    await addWin(trimmed, dayKey);
  }

  return (
    <section
      className="tl-triage-rising space-y-10 print:block"
      style={{
        paddingInline: "var(--tl-gutter)",
        paddingBlock: "var(--tl-space-lg)",
      }}
    >
      <h1 className="text-display font-light tracking-display text-ink">
        Evening review
      </h1>

      {triagedToday.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-body font-medium text-ink">Review summary</h2>
          {/*
            THE SAME READOUT PATTERNS USES, decided 2026-09-22 (D-021): the
            numeral in the display face, the label in mono beneath it, a 2x2 at
            390px opening to a row of four. Two screens that both answer "how
            many" should answer it the same way, and before this one used 15px
            body text while the other used 34px display.

            The bucket marker moved onto the label rather than being dropped.
            Colour is still never the only carrier: the word is right there.
          */}
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8">
            {BUCKETS.map((bucket) => (
              <li key={bucket} className="flex flex-col gap-1">
                <span className="text-display font-light leading-display tracking-display tabular-nums text-ink">
                  {counts[bucket]}
                </span>
                <span className="flex items-center gap-2 font-mono text-micro uppercase tracking-micro text-muted">
                  <BucketDot bucket={bucket} line="none" />
                  {BUCKET_LABELS[bucket]}
                </span>
              </li>
            ))}
          </ul>
          {carryForward ? (
            <p className="flex items-start gap-2 text-body text-ink">
              <BucketDot bucket="do" />
              <span>Carry forward: {carryForward.text}</span>
            </p>
          ) : (
            <p className="text-body text-muted">No carry-forward chosen tonight.</p>
          )}
        </section>
      ) : (
        <p className="text-body text-muted">Nothing to sort tonight.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-body font-medium text-ink">Wins</h2>
        <p className="text-small text-muted">What moved today?</p>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Field
              value={winDraft}
              onChange={setWinDraft}
              placeholder="Even tiny counts"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddWin();
                }
              }}
            />
          </div>
          <Button variant="ghost" onClick={() => void handleAddWin()}>
            Add
          </Button>
        </div>
        {wins.length > 0 && (
          <ul className="space-y-1 text-body text-ink">
            {wins.map((win) => (
              <li key={win.id}>• {win.text}</li>
            ))}
          </ul>
        )}
      </section>

      {triagedToday.length > 0 && (
        <section className="no-print space-y-3">
          <h2 className="text-body font-medium text-ink">Hands</h2>
          <p className="text-small text-muted">
            Export your do items. No paid integrations.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="py-2" onClick={() => void copyText(formatDoList(triagedToday))}>
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
            <Button variant="ghost" className="py-2" onClick={() => mailtoDoList(triagedToday)}>
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
            <ul className="space-y-1 text-body text-ink">
              {doCaptures.map((item) => (
                <li key={item.id}>• {item.text}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* The backlog lives here rather than mid-ritual: it is a decision to
          start more triage, not a checkbox to hold while triaging. Opt in,
          never a prompt. Untriaged is parked, not failure. */}
      {!includeBacklog && backlogCount > 0 && (
        <section className="no-print">
          <Button variant="ghost" className="py-2" onClick={onIncludeBacklog}>
            Include untriaged backlog ({backlogCount})
          </Button>
        </section>
      )}

      {!hasKey && (
        <p className="no-print text-small text-muted">
          No API key, so using rule-based triage. Add your Gemini key in Settings
          for AI. Capture and review still work without it.
        </p>
      )}
    </section>
  );
}
