# Deliberate

Deliberate turns debates into editable, evidence-linked argument maps.

It takes spoken debate, uploaded media, pasted transcripts, or captured web sources and converts them into an Issue-Based Information System (IBIS) map. The goal is not to declare a winner. The goal is to make the shape of a disagreement clear: the central question, the competing positions, the reasons for and against each position, and the evidence behind each claim.

**Live app:** https://usedeliberate.com  
**Repository:** https://github.com/matthewcabrera/deliberate

<p>
  <img src="public/brand/deliberate-mark-paper.png" alt="Deliberate mark" width="180" />
</p>

## Why It Exists

Debates move quickly. Even experienced debaters can lose track of how each argument relates to the others, and non-debaters often hear a fast exchange without seeing the underlying structure.

Deliberate was built to preserve that structure. With a recording, transcript, or source URL, it creates a visual flow map that can be inspected after the debate is over. Each generated claim stays connected to its source evidence, so the map is auditable instead of being an opaque AI summary.

## What It Does

Deliberate converts messy argument sources into a clean IBIS map:

- **Issues:** central questions or decision points
- **Positions:** possible answers or proposals
- **Pros:** reasons supporting a position
- **Cons:** objections or risks against a position
- **Evidence:** source-backed references, quotes, timestamps, or page captures
- **Decisions and notes:** useful context or outcomes when present

Every node is grounded in the original source where possible:

- speaker
- transcript quote
- timestamp
- source URL or captured page
- confidence and review state

## Input Modes

### Upload

Upload an audio or video file. Deliberate sends the media to Deepgram for diarized, timestamped transcription, then converts the transcript into an editable IBIS map.

### Browse

Paste a URL or PDF. Deliberate uses Browserbase to capture the source in a recorded cloud browser session, extracts readable text, stores a screenshot/replay trail, and maps the argument.

### Observe

Use the microphone to observe a live debate. Deliberate listens through the mic and grows the argument map as the debate unfolds.

### Argue

Debate a spoken AI opponent. The AI pushes back out loud, and the full exchange becomes a map you can inspect afterward.

### Transcript Paste

Paste a written transcript directly. This is the fastest path for testing the IBIS extraction pipeline without media ingestion.

## How It Works

```text
source input
  -> transcript or text capture
  -> normalized utterances
  -> Claude IBIS extraction
  -> deterministic validation and repair
  -> editable React Flow canvas
  -> evidence-linked transcript/source inspection
  -> optional Arize tracing and evaluation
```

The map is not just a drawing. It is a structured graph with typed nodes and typed edges. A repair layer enforces core IBIS rules, such as attaching pros and cons to positions rather than directly to the central issue.

## Tech Stack

| Area | Technology |
| --- | --- |
| App framework | Next.js, React, TypeScript |
| Canvas | React Flow / `@xyflow/react` |
| Voice transcription | Deepgram Nova |
| Text-to-speech | Deepgram Aura |
| Reasoning and extraction | Anthropic Claude |
| Web source capture | Browserbase, Playwright Core |
| PDF text extraction | `pdf-parse` |
| Observability | OpenTelemetry, Arize |
| Deployment | Vercel |

## Architecture

```text
src/app/page.tsx
  Main client app, menu flow, upload/browse/observe/argue screens

src/components/Workspace.tsx
  Editable IBIS canvas, transcript dock, source/video panel, node editing

src/components/Observe.tsx
  Live microphone observation mode

src/components/Argue.tsx
  Spoken debate mode against an AI opponent

src/app/api/transcribe/route.ts
  Upload and YouTube transcription endpoint

src/app/api/extract-ibis/route.ts
  Transcript to IBIS graph endpoint

src/app/api/ingest-url/route.ts
  Browserbase URL/PDF capture endpoint

src/app/api/tts/route.ts
  Text-to-speech endpoint for spoken replies

src/lib/ibis-extract.ts
  Claude prompt, schema, graph extraction, validation, and repair

src/lib/ibis-eval.ts
  Deterministic and judge-based map quality evaluation

src/lib/deepgram.ts
  Deepgram transcription normalization

src/lib/browserbase.ts
  Source capture, PDF parsing, screenshot/replay metadata

src/lib/contracts.ts
  Shared source, transcript, speaker, and IBIS graph contracts

src/lib/trace.ts
  OpenTelemetry span helpers and Arize-compatible metadata
```

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

Required for core AI functionality:

| Variable | Purpose |
| --- | --- |
| `DEEPGRAM_API_KEY` | Speech transcription and TTS |
| `ANTHROPIC_API_KEY` | IBIS graph extraction and argue mode |

Optional:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_MODEL` | Override the extraction model |
| `ANTHROPIC_ARGUE_MODEL` | Override the spoken opponent model |
| `DEEPGRAM_TTS_MODEL` | Override the Deepgram voice |
| `ARIZE_API_KEY` | Enable tracing export to Arize |
| `ARIZE_SPACE_ID` | Arize space for tracing |
| `ARIZE_PROJECT_NAME` | Arize project name |
| `ARIZE_COLLECTOR_ENDPOINT` | OTLP endpoint, defaults to Arize |
| `BROWSERBASE_API_KEY` | Enable browse mode source capture |
| `BROWSERBASE_PROJECT_ID` | Browserbase project for sessions |
| `BROWSERBASE_PROXIES` | Optional paid proxy support for blocked sites |

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Build for production:

```bash
npm run build
```

Run lint:

```bash
npm run lint
```

Run the IBIS evaluation script:

```bash
npm run eval
```

## Deployment

The project is deployed on Vercel:

```text
https://usedeliberate.com
```

Production needs the same environment variables configured in the Vercel project settings. Without the API keys, the static UI can load, but transcription, extraction, browse capture, TTS, and tracing features will not fully work.

## Current Status

Implemented:

- production Next.js app
- branded Deliberate interface
- upload flow for media files
- pasted transcript flow
- URL/PDF browse capture through Browserbase
- Deepgram transcription
- Claude IBIS extraction
- deterministic graph validation and repair
- editable React Flow workspace
- source evidence display
- live observe mode
- spoken argue mode
- Arize/OpenTelemetry tracing hooks
- Vercel deployment and custom domain

Known limits:

- YouTube ingestion can be unreliable on cloud hosts because YouTube may block serverless/cloud requests.
- Account persistence is not implemented yet.
- Maps are currently session-oriented rather than stored in a user library.
- Shared map links and collaboration are planned but not implemented yet.

## Roadmap

Next, Deliberate should become a real workspace rather than a single-session demo:

- add Supabase authentication
- save maps to user accounts
- build a personal map library
- support shareable map links
- add public read-only map views
- add permissions for private and team maps
- support comments and review workflows
- add collaborative editing
- improve speaker identity inference
- deepen Arize evaluation loops
- make live observation more robust for longer debates

## Project Story

Deliberate started from a debate problem: arguments are often rich and complex, but the structure disappears as soon as the round ends. A traditional debate flow sheet solves this for trained debaters, but it is manual and hard for outsiders to read.

This project uses AI to create that flow automatically. The hard part is not just summarizing the debate. The hard part is preserving structure while keeping every generated claim traceable to evidence.

## License

No open-source license has been added yet. Please contact the author before reusing this code outside the project.
