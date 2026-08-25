# TetherLog — product spec

**Name:** TetherLog  
**Tagline:** Log what's pulling you. Review later. See the pattern.

MIT. Inspired by capture + evening-review workflows.

---

## The point

Same job as an ADHD distraction sheet: a thought hijacks you mid-task → park it → return to what you were doing. TetherLog exists to **remove all friction** from that park. If capture is hard, the product failed.

Most apps get this wrong: they "help" at capture time and become another distraction.

**Rules:**
1. **Capture is dumb and fast** — no AI analysis, no questions, no triage. Park and leave.
2. **Always within reach** — phone-first. One tap from home/lock/widget → choose capture mode → go.
3. **Voice is fundamental** — not a nice-to-have. Text alone will not make this useful for Jen. See [Voice capture](#voice-capture).
4. **Writing is a first-class capture lane** — blog seeds, essay rants, half-formed posts. Park fast; organise in Review. See [Writing lane](#writing-lane).
5. **Review is the agent** — triage, wins, patterns happen here, not mid-task.
6. **Hands export the outcome** — `do` items leave the app (calendar, clipboard, share, email).
7. **Client-side only** — no server-held API keys or user data. See [Client-side architecture](#client-side-architecture).

---

## User flows

### 1. Capture (no AI analysis)

```
Phone (always) → one tap → pick mode → Park → gone
```

**Availability:** Must live on the phone. Installable PWA (or native shell later). Goal: one click from wherever she is, then decide *what* to capture. Details and labels are optional — only when she has time.

**Jen's device:** **Android-first.** Chrome → Install / Add to Home Screen is the daily path. iOS is secondary compatibility, not the design target.

**Two capture modes (same product, different duration):**

| Mode | When | Input | Depth |
|------|------|--------|--------|
| **Quick** | Mid-task hijack | Text *or* short voice | One tap park. Optional tag/label if she has a second. |
| **Long** | Idea dump / blog babble | Voice primary (10+ min ok) | Record freely; transcript lands with the capture. Labels later or at end. |

**Quick (text):**
- Single line (optional expand a little — not an essay box)
- Auto timestamp
- Optional one-tap tag: `now` / `later` / `?` (never required)
- Haptic/visual confirm: "Parked." — no echo of full thought unless user taps to see
- Keyboard-first on desktop: `/` or tap to focus, Enter to park, immediately ready for next or dismiss
- Works offline for text park (PWA)

**Progressive detail:** Capture never requires labels. If she has time, she can add tags / a bit more text / finish the recording. If she doesn't, one tap is enough.

### Voice capture

**North star:** Voice + transcript is the single most important capability for usefulness. Without it, friction stays too high for real ADHD capture.

**Must support:**
1. **Short voice park** — tap mic → speak a thought → stop → parked (audio + transcript when ready).
2. **Long voice dump** — start recording, babble for 10+ minutes (blog idea, rant, half-formed plan), stop when done. Audio saved. Transcript attached to the same capture.
3. **Transcript quality that is decent enough to review later** — not live coaching, not summarising mid-record. Capture stays dumb; transcript is just the text form of what was said.
4. **Audio kept with the capture** — replay in review if the transcript is messy.

**Still true:** No triage, no "what did you mean," no AI questions during capture. Transcription is input plumbing, not the Review agent.

**Open design (decide when unparking build):**
- On-device / Web Speech vs BYOK STT (affects offline + client-only rules)
- Prefer: audio always local first; transcript can catch up when network/key allows
- Long recordings: chunk or stream carefully so a 15-min babble doesn't blow the tab

**Not voice's job:** rewriting the idea into a blog post. That's Review / Hands later.

### Writing lane

Jen's blog side quest (~3h/week) needs TetherLog to **capture and organise writing stuff**, not only random distractions.

**At capture (still dumb):**
- Optional tag/label: `write` (or equivalent) — never required
- Long voice dumps and quick text parks both eligible
- No outline forced mid-task

**At review / organise:**
- Triage can bucket writing seeds as `write` (in addition to `do` | `later` | `drop` | `wonder`) — or map `write` as a specialised `later` with a clear label; pick one shape when building, don't invent two systems
- Group / filter captures tagged writing
- Hands: export a seed (or a cluster) as markdown suitable for a draft — clipboard or download
- Optional BYOK: turn a transcript into a rough outline *only in Review*, never at park

**Job split:** Capture parks the spark. Review organises the pile. Publish happens outside TetherLog.

### 2. Evening review (agent workflow)

```
Open review → wins (optional) → triage each capture → summary → hands
```

**Steps:**
1. **Wins** — "What moved today?" (optional, manual bullets — antidote to success amnesia)
2. **Capture triage** — agent walks today's captures (and untriaged backlog if user wants)
3. Each item → structured suggestion: `do` | `later` | `drop` | `wonder` + one-line reason
4. User confirms or overrides (one tap per item, swipe on mobile)
5. **Review summary** card — counts + one carry-forward max for tomorrow
6. **Hands panel** — act on `do` items (see Hands)

**Agent runs here only.** Never during capture.

### 3. Patterns (deterministic + AI flex)

**Without a key:**
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
  bucket: "do" | "later" | "drop" | "wonder" | "write"
  reason: string        // one line, warm, literal
  carryForward: boolean // max one per review session
  suggestedAction?: string  // only for "do" — e.g. "15 min block"
}
```

`write` = blog/essay seed — organise later, don't treat as a calendar `do` unless she promotes it.

Batch review returns `{ items: [...], summary: { do: n, later: n, drop: n, wonder: n, write: n } }`.

---

## Hands (browser-native)

These are **outputs**, not hosted integrations.

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
| **Writing seed export** | One capture or writing-tagged cluster → draft-ready markdown | Clipboard / File download |
| **Print review** | Print-friendly CSS | window.print() |
| **Evening reminder** | "Time for review?" at user-set hour | Web Notifications + PWA service worker |

**Not v1 (needs third-party accounts or OAuth):**
- Google Calendar API sync
- Slack/Discord webhooks
- Server-sent SMS/email
- Accounts + cloud sync

**Later:** optional sync with the user's own database (BYO) — out of v1.

---

## Client-side architecture

Data and AI stay on the device. There is no product backend for user data or model calls.

| Layer | Choice |
|-------|--------|
| Hosting | Static site |
| Database | IndexedDB via Dexie |
| Auth | None v1 — device-local data |
| LLM | **BYOK only** — key in browser localStorage, calls from client |
| AI fallback | Deterministic patterns + rule-based triage hints |
| Analytics | None, or optional host analytics |
| Notifications | Browser + service worker |

**Not collected or proxied:**
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

1. **Capture** — default landing. Fast. Text + voice (quick and long).
2. **Review** — evening ritual. Agent + hands. Audio replay + transcript on voice captures.
3. **Patterns** — charts + repeats + weekly digest entry
4. **Settings** — BYOK key (LLM + optional STT), review reminder time, export/import, theme

Phone-first (**Android**). PWA installable. One-tap path to capture is a product requirement, not polish.

---

## Tone (UI copy)

Warm, literal, spare. Anti-guilt. No streaks. No "you missed yesterday."

Untriaged captures aren't failure. Parked thoughts, not homework.

---

## v1 scope (full product — not a stub)

- [x] Spec locked (all flows above)
- [x] Capture + IndexedDB persistence
- [x] **Voice capture (quick + long) + transcript + audio stored with capture** — fundamental, not deferred "nice" (MVP Slice 1 / 7B; BYOK STT polish → 7C)
- [ ] Writing lane — `write` tag/bucket, filter/organise, markdown seed export
- [x] Evening review agentic loop — BYOK triage + rule fallback, wins, summary, Hands
- [x] Pattern dashboard (deterministic core)
- [x] Weekly digest (BYOK narrative + deterministic stats)
- [x] Core Hands (clipboard, .ics, share, mailto, print, JSON backup)
- [ ] PWA + offline text capture; voice transcript may need network/BYOK (audio still parks offline)
- [ ] Phone one-tap / install path
- [ ] Review reminder via service worker
- [x] Settings + backup import/export + BYOK honesty
- [ ] Obsidian export; Patterns chart extras (flex)

---

## Log

- 2026-08-25: Phase 7B Voice MVP — audio parks in Dexie; Web Speech best-effort; Review replay. Capture still dumb; no key required.
- 2026-08-25: Roadmap Phase 7A locked — Voice MVP next (Web Speech best-effort; BYOK STT API TBD in 7C spike). Capture stays usable with no key.
- 2026-08-25: Jen locked **Android-first** PWA install path (Chrome home screen). iOS secondary.
- 2026-08-25: Writing lane locked — capture + organise blog/essay seeds (`write` bucket/tag, seed export). Feeds Jen's blog side quest.
- 2026-08-25: Jen locked product intent — distraction-sheet job, phone always-available, one-tap then optional depth, **voice + transcript as fundamental** (quick park + long babble). Spec updated; UI build still parked until she unparks it.
- 2026-08-17: Spec locked. Client-side BYOK architecture. Hands via browser APIs.
- 2026-08-21: Agentic Review loop marked done — see `ROADMAP.md` "Done means".
