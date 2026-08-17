# TetherLog — product spec

**Name:** TetherLog  
**Tagline:** Log what's pulling you. Review later. See the pattern.

**Build in public.** MIT. Separate from Chappie — inspired by `capture` + `evening-review` skills, no private file imports.

Locked 2026-08-17.

---

## The point

ADHD/ND brains get hijacked mid-task. A capture log works — park the thought, go back. Most apps get this wrong: they "help" at capture time and become another distraction.

**Rules:**
1. **Capture is dumb and fast** — no AI, no analysis, no questions. &lt;5 seconds.
2. **Review is the agent** — triage, wins, patterns happen here, not mid-task.
3. **Hands export the outcome** — `do` items leave the app (calendar, clipboard, share, email).
4. **$0 to run** — no server bills, no API keys on our side. See [Zero-cost architecture](#zero-cost-architecture).

---

## User flows

### 1. Capture (no AI)

```
Any screen → one input → Park → gone
```

- Single line (optional expand to 2–3 lines max — not an essay box)
- Auto timestamp
- Optional one-tap tag: `now` / `later` / `?` (never required)
- Haptic/visual confirm: "Parked." — no echo of full thought unless user taps to see
- Keyboard-first: `/` or tap to focus, Enter to park, immediately ready for next or dismiss
- **Zero network.** Works offline (PWA).

### 2. Evening review (agent workflow)

```
Open review → wins (optional) → triage each capture → summary → hands
```

**Steps:**
1. **Wins** — "What moved today?" (optional, manual bullets — antidote to success amnesia)
2. **Sheet triage** — agent walks today's captures (and untriaged backlog if user wants)
3. Each item → structured suggestion: `do` | `later` | `drop` | `wonder` + one-line reason
4. User confirms or overrides (one tap per item, swipe on mobile)
5. **Review summary** card — counts + one carry-forward max for tomorrow
6. **Hands panel** — act on `do` items (see Hands)

**Agent runs here only.** Never during capture.

### 3. Patterns (deterministic + AI flex)

**Always free (no key):**
- Captures per day / week chart
- Time-of-day heatmap (when do hijacks happen?)
- Repeat detection — same or similar thoughts (fuzzy match)
- Tag breakdown
- **Stuck items** — parked 3+ times, never dropped
- Capture velocity trend

**With BYOK (user's key, client-side):**
- Theme clustering in plain language
- Weekly digest narrative (warm, spare — not telegram)
- Gentle observations ("evenings are heavy" — only if data supports it)

### 4. Weekly digest (flex)

End of week (user-triggered or Sunday nudge via notification):
- Structured card: themes, repeats, busiest slots, stuck items
- Short narrative paragraph (BYOK)
- Export as markdown or share

---

## Triage schema (agent output)

Every review suggestion must return this shape (Zod):

```ts
{
  captureId: string
  bucket: "do" | "later" | "drop" | "wonder"
  reason: string        // one line, warm, literal
  carryForward: boolean // max one per review session
  suggestedAction?: string  // only for "do" — e.g. "email landlord", "15 min block"
}
```

Batch review returns `{ items: [...], summary: { do: n, later: n, drop: n, wonder: n } }`.

---

## Hands (browser-native — $0)

These are **outputs**, not integrations we pay for.

| Hand | What | API |
|------|------|-----|
| **Copy do list** | Formatted markdown bullets | Clipboard API |
| **Copy full review** | Summary + all triage decisions | Clipboard API |
| **Download .ics** | `do` items as calendar events (user picks date/time per item or bulk tomorrow) | File download (generated client-side) |
| **Share** | Review summary or weekly digest | Web Share API (mobile) |
| **Email yourself** | Pre-filled `mailto:` with do list | mailto: |
| **Export backup** | Full IndexedDB → JSON download | File download |
| **Import backup** | Restore from JSON | File input |
| **Obsidian export** | Daily note markdown with frontmatter + captures | File download |
| **Print review** | Print-friendly CSS | window.print() |
| **Evening reminder** | "Time for review?" at user-set hour | Web Notifications + PWA service worker |

**Not v1 (needs paid service or OAuth we won't do):**
- Google Calendar API sync
- Slack/Discord webhooks on our server
- Server-sent SMS/email (SendGrid, Twilio)
- Accounts + cloud sync on our dime

**Future $0 option:** optional Supabase sync with **user's own** Supabase project (BYO database) — out of v1.

---

## Zero-cost architecture

**Hard rule:** Jen never gets a surprise bill from this product.

| Layer | Choice | Cost |
|-------|--------|------|
| Hosting | Vercel hobby / static | $0 |
| Database | IndexedDB via Dexie | $0 |
| Auth | None v1 — device-local data | $0 |
| LLM | **BYOK only** — key in browser localStorage, calls from client | User's free tier or $0 |
| AI fallback | Deterministic patterns + rule-based triage hints | $0 |
| Analytics | Optional Vercel Analytics (free tier) or none | $0 |
| Notifications | Browser + service worker | $0 |

**Never on our server:**
- API keys
- LLM proxy calls
- User data storage

**BYOK flow:**
- Settings → paste Gemini/OpenAI key → stored locally only
- Clear label: "Your key stays on this device. We never see it."
- Without key: capture + patterns + rule-based review still work; AI triage/digest disabled with honest message

**Rule-based triage fallback (no key):**
- Tag `now` → suggest `do`
- Tag `?` → suggest `wonder`
- Repeat text (3+ times) → suggest `drop` or `do` with "you've parked this before"
- Default untagged → suggest `later`

Product is **never empty** without a key. AI is enhancement, not gate.

---

## Agent demo checklist

| Box | Where |
|-----|--------|
| Workflow | Capture ≠ review hard split |
| Structured output | Zod triage schema |
| Memory over time | IndexedDB + pattern engine |
| Hands | Clipboard, .ics, share, mailto, export/import |
| Domain | ND capture-log rules baked in |
| When not to use AI | Capture has zero AI |
| Deploy | Vercel link |

---

## Tech stack

- Vite + React 19 + TypeScript strict
- Tailwind CSS v4
- Dexie (IndexedDB)
- Zod (schemas)
- Vercel AI SDK or fetch — **client-side only** with BYOK
- vite-plugin-pwa (offline capture + review reminder)
- UK English in UI copy

---

## Screens

1. **Capture** — default landing. Fast.
2. **Review** — evening ritual. Agent + hands.
3. **Patterns** — charts + repeats + weekly digest entry
4. **Settings** — BYOK key, review reminder time, export/import, theme

Mobile-first. PWA installable.

---

## Voice

Warm, literal, spare. Anti-guilt. No streaks. No "you missed yesterday."

Untriaged captures aren't failure. Parked thoughts, not homework.

---

## v1 scope (full product — not a stub)

- [x spec] All flows above
- Capture + IndexedDB persistence
- Evening review with BYOK triage + rule fallback
- Pattern dashboard (deterministic)
- Weekly digest (BYOK narrative + deterministic stats)
- All hands listed
- PWA + offline capture
- Review reminder notification
- Settings + backup import/export

---

## Chappie boundary

- Skills live in Chappie repo — reference only
- TetherLog repo has its own soul, copy, code
- No imports from private Chappie files

---

## Log

- 2026-08-17: Full spec. Zero-cost BYOK architecture. Hands via browser APIs. Flex scope locked.
- 2026-08-17: Named **TetherLog** (was working title Drop Sheet).
