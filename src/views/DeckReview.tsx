import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Heading, Input, Message, Text } from "nil-ds";
import { CopyButton, TriageCard, TriageDeck } from "../components/ui";
import { answerDeckCard, closeDeck, markDeckCopied, reopenDeckCards } from "../db";
import { answeredCount, formatDeckAnswers, MAX_NOTE, NOT_NOW } from "../lib/deck";
import { readDurationMs } from "../lib/motion";
import type { DeckAnswer, DeckCard, StoredDeck } from "../types";

/**
 * Review, when an agent has parked a deck of questions (D-047).
 *
 * THE DECK IS A STATE INSIDE REVIEW, not a fifth screen. It is the same three
 * fixed slots triage has (the count, the card, nothing else) and the same
 * motion: the existing leave and rise classes, so their reduced-motion halves
 * come with them. No model is called anywhere; every card arrives with the
 * pick and the reason already written.
 *
 * EVERYTHING HERE IS UNTRUSTED TEXT. A link can be made by anyone. React
 * renders each field as text and never as HTML. A card's link was checked as
 * https when the deck was read, and still opens with rel="noopener noreferrer".
 */

/** The card, taller than a thought card because it holds a question and its choices. */
const CARD_HEIGHT = "clamp(24rem, 62dvh, 34rem)";

interface Leaving {
  id: string;
  rect: { top: number; left: number; width: number; height: number };
  node: ReactNode;
}

/**
 * How many rows the buttons under Confirm need on a phone, for the whole deck.
 * The footer is pinned to the bottom of a fixed-height card, so if one card's
 * buttons wrapped and another's did not, Confirm would move between cards. The
 * deck decides once, from the longest set of keys, and every card reserves it.
 * Generous on purpose: nine pixels a character, 300 pixels of room.
 */
function ghostRows(cards: DeckCard[]): number {
  const widest = Math.max(
    ...cards.map((card) => {
      const keys = card.choices.filter((c) => c.key !== card.pick).map((c) => c.key);
      const words = [...keys, NOT_NOW];
      return words.reduce((sum, word) => sum + 32 + 9 * word.length, 0) + 8 * (words.length - 1);
    }),
  );
  return Math.max(1, Math.ceil(widest / 300));
}

interface DeckReviewProps {
  stored: StoredDeck;
  /** A link that could not be read, said in the reserved line. */
  notice?: string | null;
}

export function DeckReview({ stored, notice }: DeckReviewProps) {
  const { deck } = stored;
  // Answers the person has just given, shown at once while the write settles.
  // Same idea as triage's `confirmed`: the card leaves on the tap, not when the
  // database says so.
  const [pending, setPending] = useState<Record<string, DeckAnswer>>({});
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const [failed, setFailed] = useState(false);
  // A card the person went back to from the wrap-up. Answering returns there.
  const [editing, setEditing] = useState<string | null>(null);
  // The note being typed, for one card. Another card starts from its own saved note.
  const [draft, setDraft] = useState<{ id: string; open: boolean; text: string } | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const tapsRef = useRef(0);
  const focusedRef = useRef<string | null>(null);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  const answers = useMemo(() => ({ ...stored.answers, ...pending }), [stored.answers, pending]);
  const editingCard = editing ? deck.cards.find((card) => card.id === editing) : undefined;
  const current = editingCard ?? deck.cards.find((card) => answers[card.id] === undefined);
  const decided = deck.cards.filter((card) => answers[card.id] !== undefined).length;
  const rows = useMemo(() => ghostRows(deck.cards), [deck.cards]);

  /** Focus follows the card, but only after the person has tapped something. */
  useEffect(() => {
    if (!current || tapsRef.current === 0 || focusedRef.current === current.id) return;
    focusedRef.current = current.id;
    cardRef.current?.focus();
  }, [current]);

  function startLeaving(id: string, node: ReactNode) {
    const rect = slotRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLeaving((prev) => [
      ...prev,
      { id, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, node },
    ]);
    const ms = readDurationMs("--tl-spring-dismiss-duration", 200);
    timersRef.current.push(
      window.setTimeout(() => setLeaving((prev) => prev.filter((item) => item.id !== id)), ms + 40),
    );
  }

  function answer(card: DeckCard, choice: string | null, node: ReactNode, note: string) {
    const words = note.replace(/\s+/g, " ").trim();
    const given: DeckAnswer =
      choice === null
        ? { skipped: true, at: Date.now() }
        : { choice, at: Date.now(), ...(words ? { note: words } : {}) };
    startLeaving(card.id, node);
    setEditing(null);
    setDraft(null);
    setPending((prev) => ({ ...prev, [card.id]: given }));
    setFailed(false);
    tapsRef.current += 1;
    void answerDeckCard(stored.id, card.id, given).catch((error: unknown) => {
      console.warn("[tetherlog] deck answer failed for", card.id, error);
      setPending((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
      setFailed(true);
    });
  }

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

  if (!current) {
    return (
      <>
        <DeckWrapUp
          stored={{ ...stored, answers }}
          notice={notice}
          onChange={setEditing}
          onReopen={() => {
            setPending({});
            void reopenDeckCards(stored.id);
          }}
        />
        {ghosts}
      </>
    );
  }

  const total = deck.cards.length;
  const position = editingCard ? deck.cards.indexOf(editingCard) + 1 : decided + 1;
  const saved = answers[current.id]?.note ?? "";
  const note = draft && draft.id === current.id ? draft : { id: current.id, open: saved !== "", text: saved };
  const others = current.choices.filter((choice) => choice.key !== current.pick);
  const sharedHeader = (
    <header className="shrink-0">
      <div className="flex h-9 items-center justify-between gap-3">
        <p className="nil-label nil-label--accent" role="status">
          {position} of {total}
        </p>
      </div>
      {/* ONE reserved line, always this tall: the deck's title, or a failure. */}
      <div className="flex min-h-12 items-end pb-1">
        <Message tone={failed || notice ? "danger" : "neutral"}>
          {failed ? "That one did not save. It is back in the deck." : (notice ?? deck.title)}
        </Message>
      </div>
    </header>
  );

  const renderBody = (prefix: string, live = false) => (
    <>
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
        {current.question}
      </p>
      {current.context && (
        <Text size="sm" muted className="mt-2" style={{ overflowWrap: "anywhere" }}>
          {current.context}
        </Text>
      )}
      <ul className="mt-3 flex flex-col gap-2" aria-label="Choices">
        {current.choices.map((choice) => (
          <li key={choice.key} className="flex items-baseline gap-3" style={{ overflowWrap: "anywhere" }}>
            <span className="nil-label shrink-0" style={{ color: "var(--nil-color-text)" }}>
              {choice.key}
            </span>
            <span className="min-w-0">
              <span style={{ color: "var(--nil-color-text)" }}>{choice.label}</span>
              {choice.key === current.pick && (
                <span className="nil-label nil-label--accent ml-2">Suggested</span>
              )}
              {choice.detail && (
                <Text size="sm" muted>
                  {choice.detail}
                </Text>
              )}
            </span>
          </li>
        ))}
      </ul>
      {live &&
        (note.open ? (
          <div className="mt-3">
            <Input
              label="Note"
              value={note.text}
              maxLength={MAX_NOTE}
              autoFocus={note.text === ""}
              onChange={(event) => setDraft({ id: current.id, open: true, text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          </div>
        ) : (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              onClick={() => setDraft({ id: current.id, open: true, text: "" })}
            >
              Add a note
            </Button>
          </div>
        ))}
      <Text size="sm" muted className="mt-3" style={{ overflowWrap: "anywhere" }}>
        {current.reason}
      </Text>
      {current.link && (
        <a
          className="tl-quiet-link mt-1 inline-flex items-center"
          href={current.link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ paddingInline: 0 }}
        >
          {current.link.text}
        </a>
      )}
    </>
  );

  const ghostNode = (
    <TriageCard
      label={`Suggested: ${current.pick}`}
      time={deck.from}
      domId={`ghost-${current.id}`}
    >
      {renderBody(`ghost-${current.id}`)}
    </TriageCard>
  );

  return (
    <>
      <section
        className="tl-gutter tl-triage-screen flex flex-col justify-center"
        style={{
          paddingBlock: "var(--nil-spacing-md)",
          minHeight:
            "calc(100dvh - var(--nav-h) - var(--topbar-h) - var(--sample-banner-h, 0px) - var(--footer-h, 0px))",
        }}
      >
        {/* From 1024px the questions are listed beside the card, the way triage
            lists what is left to sort. Below that the list is not drawn. */}
        <DeckList cards={deck.cards} answers={answers} currentId={current.id} />
        <div className="tl-triage-detail flex min-w-0 flex-col justify-center">
        {sharedHeader}
        <div
          className="relative shrink-0"
          style={{ height: CARD_HEIGHT, marginBottom: "calc(var(--nil-spacing-sm) * 2)" }}
        >
          <TriageDeck under={editingCard ? 0 : total - position} />
          <div ref={slotRef} className="relative z-10 h-full">
            <div key={current.id} className="tl-triage-rising h-full">
              <TriageCard
                cardRef={cardRef}
                label={`Suggested: ${current.pick}`}
                time={deck.from}
                domId={`deck-${current.id}`}
                footer={
                  <div className="space-y-3">
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => answer(current, current.pick, ghostNode, note.text)}
                    >
                      Confirm {current.pick}
                    </Button>
                    <div
                      className="flex flex-wrap content-start gap-2"
                      style={{ minHeight: `calc(var(--nil-size-tap) * ${rows} + var(--nil-spacing-sm) * ${rows - 1})` }}
                    >
                      {others.map((choice) => (
                        <Button
                          key={choice.key}
                          variant="ghost"
                          aria-label={`${choice.key}: ${choice.label}`}
                          onClick={() => answer(current, choice.key, ghostNode, note.text)}
                        >
                          {choice.key}
                        </Button>
                      ))}
                      <Button variant="ghost" onClick={() => answer(current, null, ghostNode, "")}>
                        {NOT_NOW}
                      </Button>
                    </div>
                  </div>
                }
              >
                {renderBody(`deck-${current.id}`, true)}
              </TriageCard>
            </div>
          </div>
        </div>
        </div>
      </section>
      {ghosts}
    </>
  );
}

// ── the list beside the card ────────────────────────────────────────────────

/**
 * Every question in order, drawn only from 1024px, on triage's own classes. It
 * is read-only: the current question is marked, an answered one shows its key,
 * and one left open shows nothing, because open is not a failure. Nothing here
 * counts up and nothing is marked late.
 */
function DeckList({
  cards,
  answers,
  currentId,
}: {
  cards: DeckCard[];
  answers: Record<string, DeckAnswer>;
  currentId: string;
}) {
  return (
    <div className="tl-triage-list hidden min-w-0 flex-col gap-2">
      <div className="flex h-9 items-center">
        <Heading level={2} style={{ fontSize: "var(--nil-type-scale-base)" }}>
          Questions
        </Heading>
      </div>
      <ol aria-label="Questions" className="flex flex-col">
        {cards.map((card) => {
          const here = card.id === currentId;
          return (
            <li
              key={card.id}
              aria-current={here ? "true" : undefined}
              className="flex items-center gap-3"
              style={{
                minHeight: "var(--nil-size-tap)",
                padding: "var(--nil-spacing-sm) var(--nil-spacing-md)",
                borderLeft: `var(--nil-border-width-thick) solid ${here ? "var(--nil-color-accent)" : "transparent"}`,
                fontSize: "var(--nil-type-scale-sm)",
                lineHeight: 1.45,
                color: here ? "var(--nil-color-text)" : "var(--nil-color-text-muted)",
                background: here ? "var(--nil-color-surface)" : undefined,
              }}
            >
              <span className="truncate">{card.question}</span>
              {answers[card.id]?.choice !== undefined && (
                <span className="nil-label ml-auto shrink-0">{answers[card.id]?.choice}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── the wrap-up ─────────────────────────────────────────────────────────────

interface DeckWrapUpProps {
  stored: StoredDeck;
  notice?: string | null;
  /** Go back to one card to change its answer. */
  onChange: (cardId: string) => void;
  onReopen: () => void;
}

/**
 * What she chose, and the ways out. It rises on the same spring a card does and
 * celebrates nothing: finishing is not a moment (D-018).
 */
function DeckWrapUp({ stored, notice, onChange, onReopen }: DeckWrapUpProps) {
  const { deck, answers } = stored;
  const answered = answeredCount(stored);
  const open = deck.cards.length - answered;

  return (
    <section
      className="tl-gutter tl-triage-rising mx-auto flex w-full flex-col gap-6"
      style={{ maxWidth: "34rem", paddingBlock: "var(--nil-spacing-lg)" }}
    >
      <Heading level={1} style={{ fontSize: "var(--nil-type-scale-xl)" }}>
        Answers
      </Heading>
      {notice && <Message tone="danger">{notice}</Message>}
      <Text>{open === 0 ? `${answered} answered` : `${answered} answered, ${open} left open`}</Text>
      <ul className="flex flex-col gap-2">
        {deck.cards.map((card) => {
          const given = answers[card.id];
          const choice = card.choices.find((item) => item.key === given?.choice);
          return (
            <li key={card.id}>
              {/* The row is the button: tapping it goes back to that one card. */}
              <button
                type="button"
                className="tl-quiet-link flex w-full items-center justify-between gap-3 text-left"
                style={{ textDecoration: "none", color: "var(--nil-color-text)", paddingBlock: "var(--nil-spacing-sm)", overflowWrap: "anywhere" }}
                aria-label={`Change the answer to: ${card.question}`}
                onClick={() => onChange(card.id)}
              >
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: "var(--nil-type-scale-base)" }}>
                    {card.question}
                  </span>
                  <span className="block" style={{ color: "var(--nil-color-text-muted)" }}>
                    {choice ? `${choice.key}: ${choice.label}` : "Left open"}
                  </span>
                  {choice && choice.key !== card.pick && (
                    <span className="block" style={{ color: "var(--nil-color-text-muted)" }}>
                      Changed from {card.pick}
                    </span>
                  )}
                  {given?.note && (
                    <span className="block" style={{ color: "var(--nil-color-text-muted)" }}>
                      Note: {given.note}
                    </span>
                  )}
                </span>
                <span className="nil-label shrink-0" style={{ color: "var(--nil-color-text-muted)" }} aria-hidden>
                  Change
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col items-start gap-2">
        <CopyButton
          getText={() => {
            void markDeckCopied(stored.id);
            return formatDeckAnswers(stored);
          }}
        >
          Copy answers
        </CopyButton>
        <Text size="sm" muted>
          {deck.replyTo ?? "Paste them into the chat that made these cards."}
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        {open > 0 && (
          <Button variant="ghost" onClick={onReopen}>
            Answer the {open} left open
          </Button>
        )}
        <Button variant="ghost" onClick={() => void closeDeck(stored.id)}>
          Done
        </Button>
      </div>
    </section>
  );
}
