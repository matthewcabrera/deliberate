# Human Setup Checklist

This is the work an agent usually cannot complete for you because it needs account access, billing approval, API keys, local permissions, or judgment about what media you are allowed to process.

## 1. Required Accounts and API Keys

Create accounts and generate API keys for:

- [ ] **Deepgram**
  - Needed for transcription, diarization, timestamps, confidence, and utterances.
  - Create a project/API key.
  - Confirm the key has access to prerecorded transcription.

- [ ] **Anthropic**
  - Needed for transcript-to-IBIS extraction and graph repair.
  - Create an API key.
  - Confirm billing/credits are active.

- [ ] **Arize Phoenix / Arize**
  - Needed for tracing, evaluator runs, and prize documentation.
  - Create an account/project.
  - Get the Phoenix API key.
  - Get the collector endpoint.

- [ ] **Browserbase**
  - Needed for source-page capture, screenshots, session metadata, and prize story.
  - Create a project.
  - Get the Browserbase API key.
  - Get the project ID if required by the SDK.

## 2. Environment File

Create `.env.local` in the project root with real values:

```bash
DEEPGRAM_API_KEY=
ANTHROPIC_API_KEY=
PHOENIX_API_KEY=
PHOENIX_COLLECTOR_ENDPOINT=
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
```

Keep this file private. Do not commit it.

## 3. Local Machine Setup

Confirm these are installed:

- [ ] Node.js works:

```bash
node -v
npm -v
```

- [ ] ffmpeg is installed:

```bash
ffmpeg -version
```

- [ ] yt-dlp is installed if using YouTube demo audio:

```bash
yt-dlp --version
```

Install options on macOS:

```bash
brew install ffmpeg yt-dlp
```

## 4. Demo Media Readiness

For the curated YouTube demo:

- [ ] Confirm you are allowed to process the video/audio for a hackathon demo.
- [ ] Keep the URL handy:

```text
https://www.youtube.com/watch?v=lu0ic3L3Z3k
```

- [ ] Download or prepare a backup MP4/audio file in case YouTube extraction fails.
- [ ] Prepare a backup pasted transcript in case both YouTube and upload fail.
- [ ] Keep the demo video short, ideally 2-5 minutes.

## 5. Deepgram Prize Prep

Prepare to explain why voice is fundamental:

- [ ] Every IBIS node links to transcript utterance IDs.
- [ ] Every important node has speaker, quote, timestamp, and confidence.
- [ ] Clicking a node should replay or seek to the relevant audio span.
- [ ] Low-confidence transcript spans become review warnings.

Collect proof during implementation:

- [ ] Screenshot of Deepgram transcript response or normalized transcript.
- [ ] Screenshot of map node linked to timestamped evidence.
- [ ] Short clip showing node click -> audio evidence.

## 6. Arize Prize Prep

Prepare the Arize story:

- [ ] Create an Arize/Phoenix project named something like `ibis-video-map`.
- [ ] Confirm traces appear in the dashboard.
- [ ] Create or document one LLM judge/evaluator for IBIS quality.
- [ ] Save one before/after example showing prompt/schema improvement.

Screenshots to collect:

- [ ] Full pipeline trace.
- [ ] Deepgram transcription span.
- [ ] Anthropic IBIS extraction span.
- [ ] Validation/evaluator result.
- [ ] Before/after quality note.

## 7. Browserbase Prize Prep

Prepare the Browserbase story:

- [ ] Confirm Browserbase sessions work.
- [ ] Capture source page title, URL, screenshot, and session ID.
- [ ] Keep Browserbase keys server-side only.
- [ ] Do not bypass login, paywalls, DRM, or private content.

Screenshots to collect:

- [ ] Browserbase session/source capture.
- [ ] Source evidence drawer in the app.
- [ ] Any replay/live-view page if implemented.

## 8. Submission Assets

Before final demo/submission:

- [ ] 1-sentence pitch:

```text
The Shape of Disagreement turns debate videos into editable IBIS maps where every claim is grounded in timestamped speech evidence.
```

- [ ] 30-second demo script.
- [ ] 2-minute demo script.
- [ ] Screenshots of app workspace.
- [ ] Screenshots of Deepgram/Arize/Browserbase proof.
- [ ] List of sponsors used and exactly how each is core to the project.
- [ ] Backup local demo data in case live APIs fail.

## 9. Things To Avoid

- [ ] Do not commit `.env.local`.
- [ ] Do not expose API keys in browser code.
- [ ] Do not process media you do not have permission to use.
- [ ] Do not rely on live YouTube extraction as the only demo path.
- [ ] Do not wait until the end to capture sponsor proof screenshots.

