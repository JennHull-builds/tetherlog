import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Heading, Input, Message, Readout, Text } from "nil-ds";
import { SampleOffer } from "../components/Sample";
import { BucketMark, CopyButton, TriageCard, TriageDeck } from "../components/ui";
import {
  addWin,
  applyTriage,
  getCapturesForDay,
  getSettings,
  getOpenDeck,
  getUntriagedCaptures,
  getWinsForDay,
} from "../db";
import { aiTriageWithGemini, GEMINI_TIMEOUT_MS, ruleBasedTriage } from "../lib/agent";
import {
  downloadFile,
  formatDoList,
  formatReviewMarkdown,
  buildIcsForDoItems,
  mailtoDoList,
  shareText,
} from "../lib/hands";
import { useFlip } from "../lib/flip";
import { readDurationMs } from "../lib/motion";
import { formatDuration } from "../lib/voice";
import type { Capture, TriageBucket, TriageSuggestion, Win } from "../types";
import { BUCKET_LABELS, VOICE_TEXT_PLACEHOLDER, todayKey } from "../types";
import { DeckReview } from "./DeckReview";

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
        <p className="nil-label">{formatDuration(durationMs)}</p>
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

/**
 * Review. An open deck of questions from an agent shows its own state (D-047);
 * otherwise this is the triage of the person's own thoughts, untouched.
 * `notice` is a link that could not be read: said once, in danger tone.
 */
export function ReviewView({ notice = null }: { notice?: string | null }) {
  // undefined while the first read is in flight, null when there is no deck.
  const deck = useLiveQuery(getOpenDeck, [], undefined);
  if (deck === undefined) return null;
  if (deck) return <DeckReview key={deck.id} stored={deck} notice={notice} />;
  return (
    <>
      {notice && (
        <div className="tl-gutter pt-3">
          <Message tone="danger">{notice}</Message>
        </div>
      )}
      <TriageReview />
    </>
  );
}

function TriageReview() {
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
  const [statusIsError, setStatusIsError] = useState(false);
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

  // Today-tagged captures come first (D-035). Array.sort is stable, so every
  // other capture keeps the order it had. The carry-forward goes to the first
  // `do`, which is now the first Today item.
  const untriaged = useMemo(() => {
    const all = includeBacklog ? [...untriagedToday, ...olderBacklog] : untriagedToday;
    return [...all].sort(
      (a, b) => Number(b.tag === "now") - Number(a.tag === "now"),
    );
  }, [includeBacklog, untriagedToday, olderBacklog]);

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
    setStatusIsError(false);
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
      setStatusIsError(true);
    });
  }

  async function runReview() {
    if (queue.length === 0 || !settings?.geminiApiKey) return;

    setLoading(true);
    setStatusIsError(false);
    // Say how long up front: without it, a wait of more than a few seconds
    // reads as broken (Jen, 2026-11-08). Product rule 1.
    setStatus(`Gemini is sorting. This can take up to ${GEMINI_TIMEOUT_MS / 1000} seconds.`);

    try {
      const batch = await aiTriageWithGemini(settings.geminiApiKey, queue);
      setAiById(new Map(batch.items.map((item) => [item.captureId, item])));
      setStatus("Suggestions from your Gemini key (on this device).");
      setStatusIsError(false);
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `${err.message} Fell back to rule triage.`
          : "AI triage failed. Fell back to rule triage.",
      );
      setStatusIsError(true);
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
          queue={queue}
          position={done + 1}
          total={done + queue.length}
          status={status}
          statusIsError={statusIsError}
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
  /** Everything still to sort, the current one first. Shown as a list from 1024px. */
  queue: Capture[];
  suggestion: TriageSuggestion;
  position: number;
  total: number;
  status: string | null;
  statusIsError: boolean;
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
  queue,
  suggestion,
  position,
  total,
  status,
  statusIsError,
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
      {/* The thought is this screen's headline, set at the kit's xl step. */}
      <p
        id={`${prefix}-text`}
        style={{
          margin: 0,
          fontFamily: "var(--nil-font-body)",
          fontSize: "var(--nil-type-scale-lg)",
          lineHeight: 1.3,
          color: "var(--nil-color-text)",
          overflowWrap: "anywhere",
        }}
      >
        {capture.text}
      </p>
      {capture.audioBlob && capture.text === VOICE_TEXT_PLACEHOLDER && (
        <Text size="sm" muted className="mt-2">No transcript yet</Text>
      )}
      {capture.audioBlob && (
        <CaptureAudio blob={capture.audioBlob} durationMs={capture.durationMs} />
      )}
      <Text size="sm" muted className="mt-3">{suggestion.reason}</Text>
      {suggestion.suggestedAction && (
        <Text size="sm" muted className="mt-1">{suggestion.suggestedAction}</Text>
      )}
      {suggestion.carryForward && (
        // Words in full ink, and nothing else.
        <Text size="sm" className="mt-3">Carry forward (max one)</Text>
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
      label={`Suggested: ${BUCKET_LABELS[bucket]}`}
      bucket={bucket}
      today={capture.tag === "now"}
      time={timeLabel(capture.createdAt)}
      domId={`ghost-${capture.id}`}
    >
      {renderBody(`ghost-${capture.id}`)}
    </TriageCard>
  );

  return (
    <section
      className="tl-gutter tl-triage-screen flex flex-col justify-center"
      style={{
        paddingBlock: "var(--nil-spacing-md)",
        minHeight: "calc(100dvh - var(--nav-h) - var(--topbar-h) - var(--sample-banner-h, 0px) - var(--footer-h, 0px))",
      }}
    >
      {/* From 1024px the screen is two columns (D-039): the list of what is
          left to sort, then the one card. Below that the list is not drawn. */}
      <QueueList queue={queue} />
      <div className="tl-triage-detail flex min-w-0 flex-col justify-center">
      {/*
        ONE GROUP, CENTRED: the count, the status line and the deck. Every part
        of it is a fixed height, so centring it never moves Confirm between
        cards. It used to be a card filling the whole view, which on a phone was
        a tall surface with a short thought floating in it. See D-028.
      */}
      <header className="shrink-0">
        <div className="flex h-9 items-center justify-between gap-3">
          <p className="nil-label nil-label--accent" role="status">
            {position} of {total}
          </p>
          {hasKey && (
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={onAskAgent}
            >
              {loading ? "Sorting…" : "Sort with AI"}
            </Button>
          )}
        </div>
        {/* ONE reserved line, three jobs: empty, the agent's provenance, or a
            failure. Always this tall, so the card below it cannot move. */}
        <div className="flex min-h-12 items-end pb-1">
          {/* The kit's Message: always rendered so the live region exists before
              its text, red with an icon on a failure, the blinking cursor while
              Gemini works (D-040). */}
          <Message tone={statusIsError ? "danger" : "neutral"} busy={loading}>
            {status ?? (hasKey ? "" : "Sorted by rules. Add a Gemini key in Settings for AI.")}
          </Message>
        </div>
      </header>

      {/*
        THE DECK. One card on top at a fixed, compact height, and the edges of
        the cards still waiting under it. It replaced a card that filled the
        view (D-017), which spent most of a phone screen on empty surface.

        The edges render first and the card sits above them on z-10: the card
        has to occlude them for them to read as under it. The slot is the
        card's own box, so the leaving ghost is pinned to exactly the card.
      */}
      <div
        className="relative shrink-0"
        style={{
          height: "clamp(19rem, 46dvh, 26rem)",
          marginBottom: "calc(var(--nil-spacing-sm) * 2)",
        }}
      >
        <TriageDeck under={total - position} />
        <div ref={slotRef} className="relative z-10 h-full">
          <div key={capture.id} className="tl-triage-rising h-full">
            <TriageCard
              cardRef={cardRef}
              label={`Suggested: ${BUCKET_LABELS[bucket]}`}
              bucket={bucket}
              today={capture.tag === "now"}
              time={timeLabel(capture.createdAt)}
              domId={`triage-${capture.id}`}
              footer={
                <div className="space-y-3">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => onConfirm(capture, bucket, suggestion, ghostNode)}
                  >
                    Confirm {BUCKET_LABELS[bucket]}
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {overrides.map((item) => (
                      <Button
                        key={item}
                        size="sm"
                        variant="ghost"
                        onClick={() => onConfirm(capture, item, suggestion, ghostNode)}
                      >
                        {BUCKET_LABELS[item]}
                      </Button>
                    ))}
                  </div>
                </div>
              }
            >
              {renderBody(`triage-${capture.id}`)}
            </TriageCard>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

// ── the list beside the card ────────────────────────────────────────────────

/** Rows shown before "and N more", so the list ends near where the card does. */
const QUEUE_ROWS = 8;

/**
 * What is left to sort, drawn only from 1024px (D-039). It is a read-only
 * list, not a picker: the ritual is ordered on purpose (the carry-forward goes
 * to the first do, and a card is confirmed, never browsed), so a row cannot be
 * pressed to jump the queue. The card in the next column is always the first
 * row, which is why that row is marked.
 */
function QueueList({ queue }: { queue: Capture[] }) {
  const shown = queue.slice(0, QUEUE_ROWS);
  const more = queue.length - shown.length;
  // When the first row is confirmed the rest glide up one place (D-040).
  const listRef = useRef<HTMLOListElement | null>(null);
  useFlip(listRef, shown.map((item) => item.id).join());
  return (
    <div className="tl-triage-list hidden min-w-0 flex-col gap-2">
      {/* The same height as the card column's count line, so the two start together. */}
      <div className="flex h-9 items-center">
        <Heading level={2} style={{ fontSize: "var(--nil-type-scale-base)" }}>
          To sort
        </Heading>
      </div>
      <ol ref={listRef} aria-label="To sort" className="flex flex-col">
        {shown.map((item, index) => (
          <li
            key={item.id}
            data-flip-key={item.id}
            aria-current={index === 0 ? "true" : undefined}
            className="flex items-center"
            style={{
              minHeight: "var(--nil-size-tap)",
              padding: "var(--nil-spacing-sm) var(--nil-spacing-md)",
              borderLeft: `var(--nil-border-width-thick) solid ${
                index === 0 ? "var(--nil-color-accent)" : "transparent"
              }`,
              fontSize: "var(--nil-type-scale-sm)",
              lineHeight: 1.45,
              color: index === 0 ? "var(--nil-color-text)" : "var(--nil-color-text-muted)",
              background: index === 0 ? "var(--nil-color-surface)" : undefined,
            }}
          >
            <span className="truncate">{item.text}</span>
          </li>
        ))}
      </ol>
      {more > 0 && (
        <Text size="sm" muted>
          and {more} more
        </Text>
      )}
    </div>
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
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleAddWin() {
    const trimmed = winDraft.trim();
    if (!trimmed) return;
    setWinDraft("");
    await addWin(trimmed, dayKey);
  }

  return (
    <section
      className="tl-gutter tl-triage-rising flex flex-col gap-10 print:block lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-16"
      style={{ paddingBlock: "var(--nil-spacing-lg)" }}
    >
      <Heading
        level={1}
        className="lg:col-span-2"
        style={{ fontSize: "var(--nil-type-scale-xl)" }}
      >
        Evening review
      </Heading>

      {/* Two columns from 1024px (D-039): what the ritual produced and the
          wins on the left, the ways out on the right. Below that this is one
          column in the same order, with the same gaps. */}
      <div className="flex min-w-0 flex-col gap-10">
      {triagedToday.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionTitle>Review summary</SectionTitle>
          {/*
            THE SAME READOUT PATTERNS USES, decided 2026-09-22 (D-021): the
            numeral in the display face, the label in mono beneath it, a 2x2 at
            390px opening to a row of four. Two screens that both answer "how
            many" should answer it the same way, and before this one used 15px
            body text while the other used 34px display.

            The label is the word alone, on the group's fill from the kit's chart
            palette (D-041). It carried a bucket-hued dot until D-028, when there
            was no secondary palette; the kit's chart colours are the first one.
          */}
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8">
            {BUCKETS.map((bucket) => (
              <li key={bucket} className="flex flex-col items-start gap-1">
                {/* The group's fill is its mark (D-041). The word is on it. */}
                <BucketMark bucket={bucket}>{BUCKET_LABELS[bucket]}</BucketMark>
                <Readout size="md" value={String(counts[bucket])} />
              </li>
            ))}
          </ul>
          {carryForward ? (
            <Text>Carry forward: {carryForward.text}</Text>
          ) : (
            <Text muted>No carry-forward chosen tonight.</Text>
          )}
        </section>
      ) : (
        <>
          <Text muted>Nothing to sort.</Text>
          <SampleOffer withDeck />
        </>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>Wins</SectionTitle>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              label="What moved today?"
              value={winDraft}
              onChange={(event) => setWinDraft(event.target.value)}
              placeholder="Even tiny counts"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddWin();
                }
              }}
            />
          </div>
          <Button variant="ghost" icon="plus" onClick={() => void handleAddWin()}>
            Add
          </Button>
        </div>
        {wins.length > 0 && (
          <ul className="space-y-1" style={{ color: "var(--nil-color-success)" }}>
            {wins.map((win) => (
              <li key={win.id}>• {win.text}</li>
            ))}
          </ul>
        )}
      </section>

      </div>

      <div className="flex min-w-0 flex-col gap-10">
      {triagedToday.length > 0 && (
        <section className="no-print flex flex-col gap-3">
          <SectionTitle>Hands</SectionTitle>
          <Text size="sm" muted>
            Export your do items. No paid integrations.
          </Text>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => formatDoList(triagedToday)}>Copy do list</CopyButton>
            <CopyButton getText={() => formatReviewMarkdown(dayKey, triagedToday, winTexts)}>
              Copy review
            </CopyButton>
            <Button
              variant="ghost"
              icon="download"
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
            <Button variant="ghost" icon="mail" onClick={() => mailtoDoList(triagedToday)}>
              Email do list
            </Button>
            {canShare && (
              <Button
                variant="ghost"
                icon="share"
                onClick={() =>
                  void shareText("TetherLog review", formatDoList(triagedToday)).catch(
                    () => undefined,
                  )
                }
              >
                Share
              </Button>
            )}
            <Button variant="ghost" icon="printer" onClick={() => window.print()}>
              Print
            </Button>
          </div>
          {doCaptures.length > 0 && (
            <ul className="space-y-1" style={{ color: "var(--nil-color-text)" }}>
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
          <Button variant="ghost" onClick={onIncludeBacklog}>
            Include untriaged backlog ({backlogCount})
          </Button>
        </section>
      )}

      {!hasKey && (
        <Text size="sm" muted className="no-print">
          No API key, so using rule-based triage. Add your Gemini key in Settings
          for AI. Capture and review still work without it.
        </Text>
      )}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Heading level={2} style={{ fontSize: "var(--nil-type-scale-base)" }}>
      {children}
    </Heading>
  );
}
