# The Shape of Disagreement

> Historical build notes (includes the now-removed Arize and Browserbase stages).
> For the clean, current summary of the project, read `PROGRESS.md`.

## Current Direction

The project is now a hackathon-focused Next.js app for turning short video sources into editable, evidence-linked IBIS maps.

Core flow:

```text
YouTube URL or MP4/audio upload
  -> source capture
  -> audio extraction
  -> Deepgram transcript with speakers/timestamps
  -> Anthropic IBIS extraction
  -> validation and repair
  -> editable 2D map with transcript/audio evidence
  -> Arize Phoenix tracing and evaluation
  -> Browserbase source evidence capture
```

The older static browser visualization and TouchDesigner work are archived in:

```text
archive/legacy-static-touchdesigner/
```

TouchDesigner is deferred. It should not block the web product.

## Active Product Goal

Build a work tool, not an art-only visualization.

The product should help someone inspect a debate, meeting, lecture, or argument-heavy video by converting speech into an editable IBIS/dialogue map:

- `issue`: question or decision point
- `position`: possible answer or proposal
- `pro`: reason supporting a position
- `con`: objection or risk
- `decision`: accepted/rejected/deferred outcome
- `note`: useful context
- `reference`: transcript/source evidence

Every important map node should be grounded in transcript evidence: speaker, quote, timestamp, confidence, and eventually replayable audio.

## Current Implementation Status

Stage 1 is implemented as a Next.js shell.

Active app files:

- `src/app/page.tsx`: clickable Import, Processing, and Workspace views.
- `src/app/globals.css`: current UI styling.
- `src/app/layout.tsx`: app metadata/layout.
- `src/lib/contracts.ts`: shared TypeScript contracts for jobs, source records, transcripts, and IBIS graphs.
- `src/lib/demo-data.ts`: mocked curated demo job using `https://www.youtube.com/watch?v=lu0ic3L3Z3k`.
- `research/`: sponsor and product research packet.
- `research/miro-workspace-ui.md`: Miro-inspired workspace direction for the next UI pass.

Stage 1 capabilities:

- Shows the intended app flow: Import -> Processing -> Workspace.
- Defines the shared data contracts for later backend integrations.
- Uses mocked Deepgram/IBIS/Arize/Browserbase artifacts.
- Shows a rough transcript/map/inspector workspace.

Stage 1 does not yet:

- Download YouTube audio.
- Call Deepgram.
- Call Anthropic.
- Persist real jobs.
- Create real Arize traces.
- Call Browserbase.

## Stage 1B + canvas (done)

The UI has been redesigned and the canvas is real:

- Two-color minimalist theme (ink-on-paper, opacity-driven hierarchy, no hue).
  Tokens live at the top of `src/app/globals.css` (`--paper`, `--ink`, opacity
  steps); inverting two values flips the whole app to a light canvas.
- Miro-inspired workspace shell in `src/components/Workspace.tsx`: top status
  bar, collapsible transcript dock, full canvas, contextual inspector dock.
- The map is now **React Flow** (`@xyflow/react`), not a mock: pan/zoom, drag,
  drag-to-connect handles, minimap, zoom controls, fit view.
- Floating left tool rail adds issue/position/pro/con/decision/evidence nodes,
  a connect hint, and undo/redo (state-backed history).
- IBIS symbols are explicit (`?`, `!`, `+`, `−`, `✓`, `·`, `↗`). In two colors,
  pro = filled badge / solid edge, con = dashed badge / dashed edge.
- `src/lib/layout.ts` computes the initial top-down IBIS tree from graph edges
  and seeds React Flow node positions (reused, not throwaway).

Still mocked: the IBIS map graph reads from `src/lib/demo-data.ts` (Stage 3
will extract a real graph from the transcript).

## Stage 2: Deepgram transcription (wired, needs a valid key)

Real prerecorded transcription is implemented:

- `src/app/api/transcribe/route.ts` — POST endpoint. Accepts `{ youtubeUrl }`
  (JSON) or a multipart file upload. YouTube path: yt-dlp extracts audio, then
  Deepgram. Upload path: ffmpeg normalizes to 16k mono wav, then Deepgram.
  Persists `data/jobs/<id>/transcript.json` (gitignored).
- `src/lib/deepgram.ts` — calls Deepgram REST (`nova-3`, smart_format, diarize,
  utterances) and normalizes the response to the `NormalizedTranscript`
  contract.
- Import tab runs it live with progress; Processing tab shows duration,
  utterance/speaker counts, summary, and a transcript preview; the real
  transcript flows into the Workspace transcript dock.
- Secrets live in `.env.local` (gitignored): `DEEPGRAM_API_KEY`, plus optional
  `YT_DLP_PATH` / `FFMPEG_PATH` / `FFMPEG_DIR` absolute paths.

Verified end-to-end with a real key: the LBC debate video transcribed in ~10s
(49 utterances, 5 speakers, diarized + timestamped).

## Stage 3: Anthropic IBIS extraction (done)

Transcript → editable IBIS graph via Claude:

- `src/lib/ibis-extract.ts` — calls Claude (default `claude-opus-4-8`, override
  with `ANTHROPIC_MODEL`) with structured outputs (`output_config.format`,
  json_schema) so the response is always a parseable graph. The system prompt
  encodes the IBIS node/edge grammar from `research/ibis-notation.md`.
  `validateAndRepair` enforces the directional rules (answers: position→issue,
  supports: pro→position, objects_to: con→position, …), drops edges that
  violate the grammar or reference missing nodes, and flags low-confidence
  nodes — all surfaced as graph `warnings`.
- `src/app/api/extract-ibis/route.ts` — POST `{ transcript, jobId? }` → graph,
  persisted to `data/jobs/<id>/graph.json`.
- Import → Processing auto-runs extraction after transcription; the IBIS step
  shows live status and node/link counts. The real graph flows into the
  Workspace (`computeTreeLayout` lays it out; nodes carry real utterance ids,
  so the inspector's evidence panel links back to the actual speech).

Verified end-to-end: the North Sea drilling debate produced a 13-node graph
(1 issue, 2 positions, 5 pros, 4 cons, 1 note) in ~31s; the validator caught
and dropped one grammar-violating edge.

Keys live in gitignored `.env.local`: `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`,
optional `ANTHROPIC_MODEL`, and the media-tool paths.

## Sponsor Strategy

Primary sponsor priorities:

1. Deepgram: core voice layer. Voice must be fundamental, not a side feature.
2. Arize Phoenix: trace/evaluate the AI pipeline and document improvement.
3. Browserbase: source capture and evidence trail for URL-based ingestion.
4. Anthropic: transcript-to-IBIS reasoning and repair.

Best prize narrative:

- Deepgram: every node is linked to timed speech evidence.
- Arize: every pipeline run is traced, judged, and improved.
- Browserbase: every source URL has captured context and trust metadata.

## Immediate Next Plan

Before moving to Stage 5+ sponsor integrations, complete the blocking UI and feature fixes in:

```text
CLAUDE_ATTENTION_BEFORE_STAGE_5.md
```

Priority fixes:

- Rename visible product identity to `deliberate`.
- Change default Anthropic model from Opus to Haiku 4.5 or the correct current Haiku model ID.
- Improve speaker labels so the inspector uses inferred/manual names when possible instead of only `Speaker 1`, `Speaker 2`, etc.
- Replace the current main screen with a minimal four-option menu: `upload`, `browse`, `observe`, `argue`.
- Add the `deliberate` opening animation.
- Move the visual direction toward off-white paper, black sumi-e/shodo-style topography, and minimalist typography.
- Use clean circular loading indicators with the phrase `deliberating`.
- Make transcript/content source sidebars feel like quiet paper surfaces.

## Stage 5: Arize tracing + IBIS-correctness evaluation (done)

Every pipeline run is traced to Arize AX and scored for IBIS correctness:

- `src/instrumentation.ts` + `src/lib/otel.ts` — Next.js `register()` sets up
  OpenTelemetry → OTLP exporter to `https://otlp.arize.com/v1/traces`
  (headers `space_id`/`api_key`), resource attr `openinference.project.name`.
  Diagnostics logger surfaces export failures. `next.config.ts` externalizes
  the OTel packages.
- `src/lib/trace.ts` — `tracer`, `traced()` span helper, `llmAttributes()`
  (OpenInference LLM-span conventions so Arize renders input/output), `flushTraces()`.
- Spans: `deepgram.transcribe` (duration, utterance/speaker counts, confidence),
  `ibis.pipeline` → `ibis.extract` (LLM span: transcript in / graph out, model,
  token counts, node/edge/evidence counts) → `ibis.evaluate` → `ibis.judge`.
- `src/lib/ibis-eval.ts` — deterministic eval (grounding coverage, orphans,
  issue present, warnings) + an LLM-as-judge (`ANTHROPIC_JUDGE_MODEL`, default
  `claude-sonnet-4-6`) scoring grounding / structure / coverage EXCELLENT→POOR
  with explanations. The judge runs only when the request passes `judge: true`
  (keeps the live UI path fast); `/api/extract-ibis` returns a `quality` summary.
- `scripts/eval-ibis.mjs` (`npm run eval`) — re-extracts + judges the saved
  transcripts and prints an aggregate score; each run is traced. The "watch the
  score improve as we tune the prompt" loop.

Verified: traces export without auth/network errors; the Sonnet judge catches
real extraction errors (miscategorized nodes, weak structural links from the
orphan-repair fallback). Keys in `.env.local`: `ARIZE_API_KEY`, `ARIZE_SPACE_ID`,
`ARIZE_PROJECT_NAME`, `ARIZE_COLLECTOR_ENDPOINT`.

## Stage 6: Browserbase "browse" mode (done)

The `browse` menu turns a URL into an evidence-backed IBIS map:

- `src/lib/browserbase.ts` — `captureUrl()` opens the page in a recorded
  Browserbase session (`@browserbasehq/sdk` + `playwright-core` over CDP),
  grabs title + body text + a screenshot + the session id. `pageTextToTranscript()`
  chunks the page text into the `NormalizedTranscript` shape so the existing
  extractor runs unchanged (grounding is by text quote, `sourceType: "webpage"`,
  with `browserbaseSessionId` + `screenshotPath` on the source record).
- `src/app/api/ingest-url/route.ts` — POST `{ url }` → capture → transcript,
  traced as a `browserbase.ingest` span; returns the transcript + screenshot
  (data URL) + session replay link. Persists `screenshot.png` + `transcript.json`.
- Frontend: the `browse` menu is a URL input; `VideoPanel` gained a `webpage`
  source that shows the captured screenshot + a "view session" Browserbase
  replay link (the visible trust layer) in the workspace's top panel.
- Reuses Deepgram-style flow: ingest → extract-ibis → workspace. The IBIS
  correctness evaluator and tracing apply the same as for audio sources.

Verified end-to-end: captured a Wikipedia article in ~6s (recorded session +
236KB screenshot) and produced a 29-node IBIS map. Keys in `.env.local`:
`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`.

All four sponsors are now wired: Deepgram (voice), Anthropic (IBIS reasoning),
Arize (tracing + evaluation), Browserbase (source capture).

## Stage 7: Deepgram live voice — observe + argue (done)

The two live menu modes are real. This key can't mint ephemeral/scoped Deepgram
tokens (`grant` and `keys:write` both 403), so live audio uses **segmented
prerecorded REST** instead of a WebSocket — the browser records short audio
segments and POSTs them; the Deepgram key never reaches the client.

- `src/lib/use-mic.ts` — `useMic()` captures the mic (`getUserMedia` +
  `MediaRecorder`) and posts segments to `/api/transcribe-chunk`. Two shapes:
  `startContinuous()` (rolling ~5s segments, observe) and `startTurn()/endTurn()`
  (push-to-talk, argue).
- `src/app/api/transcribe-chunk/route.ts` — webm bytes → Deepgram nova-3 REST →
  text. Traced as `deepgram.live_chunk`.
- `src/lib/live-transcript.ts` — `buildLiveTranscript()` wraps live turns into the
  `NormalizedTranscript` shape so `extract-ibis` maps them unchanged.
- **observe** (`src/components/Observe.tsx`) — listens continuously; re-extracts
  the IBIS map every ~20s; renders the live map in the reused `Workspace` with a
  "● observing" overlay.
- **argue** (`src/components/Argue.tsx`) — push-to-talk debate. Your turn is
  transcribed → `/api/argue` (Claude `claude-haiku-4-5`, `argue.rebuttal` span)
  returns a rebuttal → `/api/tts` (Deepgram **Aura**, `aura-2-thalia-en`) speaks
  it → the whole debate is mapped to IBIS. Opponent holds a coherent opposing line.

Verified the full loop via a TTS→webm→STT round-trip (exact text returned) and
the Claude opponent + Aura routes (HTTP 200). Mic capture needs localhost/HTTPS
(`getUserMedia`). Optional env: `DEEPGRAM_TTS_MODEL`, `ANTHROPIC_ARGUE_MODEL`.

## Commands

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```
