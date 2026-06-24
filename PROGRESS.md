# Deliberate — Progress Log

The single, clean record of what has been built and decided. For deeper build
notes see `AGENT.md` (historical); for the live task board see the Notion
"Deliberate Roadmap"; for go-to-market strategy see the agent-memory folder
(`.claude/agent-memory/debate-monetization-strategist/`).

Last updated: 2026-06-24.

---

## What it is

Deliberate turns a debate into an editable, evidence-linked **IBIS argument map**
(the digital version of a debater's "flow"). You give it a debate as a video,
audio file, YouTube link, or pasted transcript, and it produces a map of the
**issue → positions → pros / cons / evidence**, where every node links back to
the exact transcript quote and timestamp.

Positioning: **automated flowing + film review for debate teams.**

Live at **usedeliberate.com** (Vercel).

---

## Where it stands today

**Working in the app (menu: upload · observe · argue):**
- **Upload** an mp4 / audio file → diarized, timestamped transcript → IBIS map.
- **YouTube** link → audio via RapidAPI → transcript → map (works on serverless).
- **Transcript paste** → map.
- **Observe** — listens to a live debate through the mic and builds the map live.
- **Argue** — you debate a spoken AI opponent (Deepgram Aura voice); the exchange
  becomes a map.
- **See an example** — loads a prebuilt demo map instantly (no waiting, no API).
- Every node click seeks the video to that moment (the core "wow").

**Deployed:** usedeliberate.com. Prod env vars set: `DEEPGRAM_API_KEY`,
`ANTHROPIC_API_KEY`, `RAPIDAPI_KEY`. (Browserbase/Arize no longer used.)

**Not built yet (next):** accounts/teams, the classroom view + roster, the
per-student video library, dropped-argument detection, billing.

---

## Tech stack

- **Next.js 16** (Turbopack), TypeScript, React Flow for the map canvas.
- **Deepgram** — transcription (`nova-3`, diarized) and Aura TTS for the AI opponent.
- **Anthropic Claude** — IBIS extraction (`claude-haiku-4-5`) + an in-code judge
  (`claude-sonnet-4-6`) that scores map quality. Structured outputs guarantee a
  parseable graph; a validation-and-repair pass enforces the IBIS grammar.
- **RapidAPI (youtube-mp36)** — serverless YouTube audio (poll → download MP3 with
  a Referer header → Deepgram). Local `yt-dlp` is a dev-only fallback.
- Persistence is currently per-session only (jobs written to `/tmp`); no database yet.

---

## Key product decisions

- **Wedge:** debate teams (film review), expanding later to a general "reasoning
  workspace." The IBIS map *is* a debate flow.
- **Monetization:** B2B **team license** — a coach buys annual, invites students.
  Free solo tier → paid team tier. Planned stack: Supabase + Stripe.
- **Students are coach-tagged, not account-holders** (v1) — no student logins/PII,
  far smaller legal surface (minors, FERPA/COPPA).
- **Video is linked (YouTube/Drive), not stored** (v1) — avoids most storage cost
  and DMCA exposure.
- **Removed Browserbase and Arize** — they were hackathon sponsors and did not fit
  the film-review focus.

---

## Build history (chronological)

**Foundation.** Next.js shell, shared TypeScript contracts, two-color ink-on-paper
theme, and a real **React Flow** map canvas (pan/zoom, drag-to-connect, IBIS node
grammar, top-down tree layout).

**Transcription (Deepgram).** Prerecorded transcription wired end-to-end:
diarized, timestamped utterances normalized to a shared transcript contract.

**IBIS extraction (Anthropic).** Transcript → IBIS graph via Claude with structured
outputs. A `validateAndRepair` pass enforces the directional rules (positions
answer issues; pros support positions; cons object to positions; evidence refers
to claims) and re-links stray nodes to their correct parent, so maps are
structurally valid by construction.

**Identity + UX pass.** Renamed to **deliberate**; default model set to Haiku;
minimalist menu (upload / observe / argue), opening animation, paper-surface docks.

**Live voice (Deepgram).** **Observe** (mic → rolling segments → live transcript →
map re-extracted every ~20s) and **Argue** (push-to-talk → Claude rebuttal →
spoken back via Aura → mapped). Live audio uses segmented prerecorded REST so the
Deepgram key never reaches the browser.

**Serverless reliability.** YouTube moved off the local `yt-dlp` binary to the
RapidAPI path; uploads send bytes straight to Deepgram (no `ffmpeg`). Both now run
on Vercel. Added a landing hero line and the instant "see an example."

**Removed (sponsor-only).** Stripped out **Browserbase** (the "browse" URL/topic
mode) and **Arize** (OpenTelemetry tracing + eval dashboard). The in-code IBIS
judge was kept; `trace.ts` is now a no-op shim.

**Pivot to debate film review.** Locked the B2B team-license direction and the
classroom/video-library plan (coach-tagged students, linked video). These are the
next features to build.

---

## Related documents

- `AGENT.md` — detailed historical build notes (includes the now-removed Arize and
  Browserbase stages; kept as a record).
- Notion **Deliberate Roadmap** — live tasks with owners (Matthew/Jairo/Evan),
  deadlines, and status.
- `.claude/agent-memory/debate-monetization-strategist/` — market, pricing, and the
  first-10-users plan.
