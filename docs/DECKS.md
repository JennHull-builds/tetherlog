# Decks

A deck is a set of questions an agent parks for a person to answer in Review, one card and one tap at a
time. The cards travel inside a link. There is no account and no server. Decisions and the reasons are
in D-047 in `docs/DECISIONS.md`.

```
agent writes deck.json ──▶ node scripts/park.mjs ──▶ link ──▶ person opens it ──▶ Review: one card, one tap
                                                                                        │
                                  agent reads the pasted text ◀── person pastes ◀── Copy answers
```

## The shape

A deck is JSON. `scripts/fixtures/deck-example.json` is a small working one.

| Field | Rule |
|---|---|
| `v` | The number `1`. |
| `id` | 1 to 60 characters: lower case letters, digits and hyphens. The same id is the same deck, so a link opened twice does not start it over. |
| `title` | 1 to 60. Shown under the count. |
| `from` | 1 to 40. Who parked it, in words. Shown on every card as given. It is a claim, not a proof. |
| `createdAt` | An ISO date and time. |
| `replyTo` | Optional, up to 120. Where the answers go, in words. |
| `cards` | 1 to 12 cards. Ids unique within the deck. |

A card:

| Field | Rule |
|---|---|
| `id` | 1 to 40, same characters as a deck id. It comes back in the answer. |
| `question` | 1 to 80. |
| `context` | Optional, up to 240. What and where, so the card stands alone. |
| `pick` | The key the agent suggests. Must be one of the choices' keys. |
| `reason` | 1 to 200. Why that pick. |
| `choices` | 2 to 4. Keys unique within the card. |
| `link` | Optional. `href` is `https://` only, up to 300 characters, no spaces. `text` is 1 to 40. |

A choice: `key` (1 to 12 characters, the word on its button, never "Not now" in any letter case),
`label` (1 to 60, what choosing it means), and `detail` (optional, up to 160).

Limits count characters after trimming. A deck that fails any check is refused whole, and the person sees
one line saying the link could not be read. Part of a deck is never shown.

**A card must never hold a secret.** The whole deck is in the link, and a link ends up in chat history,
browser history and screenshots. Put no key, token, password or private address in a card.

## The link

`<address>/#deck=1.<payload>`

- `1` is the format number. It is reserved so a smaller format can come later. A link with another
  number is refused.
- The payload is the deck as JSON, UTF-8, base64url, no padding. It is read with a strict UTF-8 decoder
  and refused over 100,000 characters.
- Everything after the `#` stays in the browser. A browser does not send it to the server.

## Making a link

```
node scripts/park.mjs deck.json --base <address> [--open]
```

- The link is the only thing printed on stdout. Problems go to stderr and name the card and the field.
- The deck is checked with the same code the app uses to read it, so a link made here is one the app accepts.
- There is no default address. Pass `--base`, or set `TETHERLOG_BASE`. A link pointed at a build that cannot
  read decks opens Capture and says nothing, so the address has to be a deliberate choice.
- `--out <folder>` also writes `<deck id>.html` in that folder: a page that forwards to the link at once, with a
  plain "Open the deck" link in case forwarding is blocked. Use it so a long link never has to be pasted into a
  note or a chat. Link a note to the small page instead.
- `--open` opens the link in the default browser.

## What the person sees

Each card shows the question, the context, the choices with the agent's pick marked "Suggested", the
reason, and the link if there is one. One tap answers: `Confirm` for the pick, a key for another choice,
or `Not now` to leave the card open without blocking the ones behind it. After the last card the person
sees what they chose and presses `Copy answers`.

Closing the tab mid-deck loses nothing. The deck and its answers are stored on the device, and opening the
same link again carries on where the person stopped.

## What comes back

The person pastes the copied text to the agent, which reads it with `scripts/answers.mjs` (below). One line per card, then a count. The text for the example deck:

```
TetherLog answers
Deck: example-deck (Example questions)
From: An agent
Answered: 2026-11-13 09:14

rename-export: A = Keep the name [the agent's pick]
empty-state: B = Show a sample [changed from A]
old-flag: left open

2 of 3 answered. Left open means no decision: the agent's pick is not approved.
```

The time is local, 24-hour. The second sentence of the last line appears only when a card was left open.
A card left open is no decision, so an agent must never treat its pick as approved.

## Reading the answers back

```
node scripts/answers.mjs deck.json answers.txt
pbpaste | node scripts/answers.mjs deck.json
```

The script reads the pasted text against the deck it came from and prints JSON: for each card, its id,
whether it was `answered` or `left open`, the key and label chosen, the agent's pick, and whether the choice
differs from the pick. The JSON begins like this:

```
{ "deck": "example-deck", "answered": 2, "total": 3,
  "answers": [ { "id": "rename-export", "status": "answered", "choice": "A", "label": "Keep the name",
                 "pick": "A", "changedFromPick": false }, ... ] }
```

It is strict on purpose. A paste for another deck, a card the deck does not have, a key or label the card
does not hold, a repeated card, a card missing, or a paste cut short is refused. The error names the line and
the exit code is 1. `readDeckAnswers` in `src/lib/deck.ts` is the same check, and it is the reverse of
`formatDeckAnswers`.

**Left open means no decision.** A card that came back `left open` was not answered. The agent's pick on it is
not approved, and silence is never a yes. Whoever reads the answers does nothing for that card and keeps it
waiting.

## Untrusted input

Anyone can make a link, so a deck is untrusted. Every field is rendered as text and never as HTML. A card's
link opens in a new tab with `rel="noopener noreferrer"` and only if it starts with `https://`. Every limit
above is enforced when the link is read. The code is `src/lib/deck.ts`, the tests are
`scripts/test-deck.mjs`, and the view is `src/views/DeckReview.tsx`.
