# Claude Attention: Fix Before Stage 5+

Do these before moving on to Arize/Phoenix or Browserbase prize integrations.

The current priority is product clarity and UI direction, not adding more backend sponsors.

## Blocking Product Fixes

### 1. Rename Product To `deliberate`

Replace old visible names:

- `The Shape of Disagreement`
- `Video to evidence-linked IBIS map`
- any old prototype copy that makes the app feel like an art project

Use:

```text
deliberate
```

Style rule:

- lowercase in the UI: `deliberate`
- minimal, quiet, not exciting
- no dramatic tagline on the main screen

### 2. Use Haiku, Not Opus

Current code still defaults to Opus:

```text
src/lib/ibis-extract.ts
```

Change default Anthropic model from:

```text
claude-opus-4-8
```

to Haiku 4.5 or the correct current Haiku model ID available in the Anthropic account.

Keep `ANTHROPIC_MODEL` override support.

Required behavior:

- default should be the cheaper Haiku model
- document the model in `.env.local` setup comments if needed
- do not require Opus for normal demo runs

### 3. Improve Speaker Names

Current Deepgram normalization creates labels like:

```ts
speakerLabel: `Speaker ${speaker + 1}`
```

This is acceptable as a fallback only.

Improve inspector/transcript behavior:

- Try to infer speaker names from transcript text when possible.
- If names are not inferable, keep `Speaker 1`, `Speaker 2`, etc.
- Allow manual speaker rename in the UI.
- Renaming should update transcript labels and node inspector labels.

Suggested simple v1 approach:

- Detect explicit speaker names from source transcript text if available.
- Detect moderator introductions like `Alice says`, `Bob argues`, or labels in pasted transcript.
- Add a speaker map:

```ts
type SpeakerProfile = {
  id: string;
  label: string;
  inferredName?: string;
  editableName?: string;
  confidence: "low" | "medium" | "high";
};
```

The inspector should display the best available name:

```text
editableName || inferredName || speakerLabel
```

## Main UI Redesign

The current UI should be redesigned around a minimal opening menu and a Miro-like workspace.

### Opening Animation

When the site opens:

- show `deliberate`
- use a brief clean animation
- then fade/slide it away
- land on the minimal main menu

Keep animation subtle:

- no flashy effects
- no large gradient
- no dramatic motion
- target duration: about 900-1400ms

### Main Screen

The main screen should be extremely minimal.

Background:

- off-white paper texture
- black ink-like sumi-e / shodo-style topographic marks
- minimalist typography
- no dark dashboard look
- no heavy cards

Main menu options, top-down order:

```text
upload
browse
observe
argue
```

Behavior:

- `upload` opens a second minimal top-down selector:

```text
youtube url
mp4/audio
transcript
```

- `browse` leads to the Browserbase/browser-use source capture feature.
- `observe` leads to the live debate feature with Deepgram's voice agent.
- `argue` lets the user argue directly with Deepgram.

For now, if `browse`, `observe`, or `argue` are not implemented, they should open a clean placeholder state that explains the mode in one line and gives a way back.

### Workspace UI

The workspace should feel like:

```text
Miro canvas + paper transcript sidebar + IBIS evidence inspector
```

Required changes:

- cleaner paper side-bar for transcript and content source
- canvas remains dominant
- transcript/source dock should feel like paper, not a dashboard panel
- inspector should feel contextual and quiet
- use IBIS symbols clearly: `?`, `!`, `+`, `-`, check, note, source
- retain smooth pan/zoom/editing behavior

### Loading State

While Deepgram and Anthropic are transcribing/extracting:

- use clean circular loading indicators
- use phrase:

```text
deliberating
```

Avoid:

- verbose technical pipeline labels as the primary visual
- noisy progress dashboards
- flashy spinners

Technical steps can still exist in secondary/debug detail.

## Design Language

Reference:

- Miro interaction grammar for canvas/workspace behavior
- Japanese paper/ink visual tone for the surface
- minimalist typography for product clarity

Do not make it look like:

- a generic SaaS dashboard
- a chatbot
- a dark analytics app
- a decorative art website

## Git Setup Note

This folder is not currently a git repository.

Before serious Stage 5+ work, initialize git and make the first checkpoint commit.

Recommended:

```bash
git init
git add .
git status
git commit -m "Initialize deliberate app"
```

Before committing, confirm these are not tracked:

- `.env`
- `.env.local`
- `LOCAL_SETUP_VALUES.md`
- `data/jobs/`
- `.next/`
- `node_modules/`

The existing `.gitignore` already excludes those.

Decision to make:

- Either commit `archive/legacy-static-touchdesigner/` for history,
- or move it outside the repo before the first commit if you want a cleaner project history.

Recommendation: move the archive outside the repo before first public push, but keep it locally until the hackathon is over.

