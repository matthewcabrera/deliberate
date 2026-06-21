# Browserbase Implementation Plan

## Goal

Use Browserbase as the source ingestion and evidence layer:

```text
URL/source page
  -> Browserbase Fetch or browser session
  -> screenshots, source text, metadata, replay
  -> evidence records
  -> IBIS map nodes with source trails
```

Browserbase should not be hidden scraping infrastructure. It should be visible in the product as the trust layer.

Sources:

- Browserbase docs: https://docs.browserbase.com/welcome/introduction
- Browser sessions: https://docs.browserbase.com/platform/browser/getting-started/create-browser-session
- Fetch: https://docs.browserbase.com/platform/fetch/overview
- Search: https://docs.browserbase.com/platform/search/overview
- Session replay: https://docs.browserbase.com/platform/browser/observability/session-replay
- Live View: https://docs.browserbase.com/platform/browser/observability/session-live-view
- Stagehand: https://docs.stagehand.dev/

## Product Fit

Browserbase can power:

- source-backed IBIS nodes
- rendered page capture
- screenshots
- session replay
- human-in-the-loop ingestion
- extraction from JavaScript-heavy pages
- source confidence indicators

## Workflow A: YouTube or Video Page

Prefer official/permitted paths for captions and metadata.

Use Browserbase to:

- render the page
- capture title/channel/description/context
- capture screenshot
- detect transcript UI availability
- record session replay

Store source anchors on generated nodes:

```text
source_url
video_id
start_time
end_time
quote
browserbase_session_id
screenshot_id
replay_page_id
```

## Workflow B: Web Page With Article/Video

1. Try Browserbase Fetch as markdown.
2. If static fetch is insufficient, open Browserbase browser session.
3. Extract title, article body, embedded videos, cited links, screenshots.
4. Send extracted source text to IBIS generation.
5. Attach evidence records to every generated node.

## Architecture

```text
Frontend
  URL input
  ingestion progress
  Browserbase Live View
  evidence drawer
  editable IBIS canvas

Backend
  /api/ingest
  /api/ingest/:jobId
  /api/browserbase/replay/:sessionId/:pageId
  /api/evidence/:sourceId

Worker
  URL classifier
  Browserbase Fetch adapter
  Browserbase Playwright adapter
  Stagehand extraction adapter
  source normalizer
  IBIS generator
```

## Evidence Model

```ts
type SourceRecord = {
  id: string;
  inputUrl: string;
  canonicalUrl: string;
  sourceType: "youtube" | "webpage" | "pdf" | "unknown";
  title?: string;
  fetchedAt: string;
  browserbaseSessionId?: string;
};

type EvidenceSpan = {
  id: string;
  sourceId: string;
  kind: "transcript" | "page_text" | "screenshot" | "dom" | "metadata";
  text?: string;
  url: string;
  startTimeSec?: number;
  endTimeSec?: number;
  selector?: string;
  screenshotUrl?: string;
  confidence: number;
};
```

## Browserbase Session Pattern

```ts
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

export async function openSourcePage(url: string) {
  const session = await bb.sessions.create({
    browserSettings: {
      viewport: { width: 1365, height: 900 },
      recordSession: true,
    },
    metadata: { product: "ibis-source-ingestion", inputUrl: url },
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const title = await page.title();
  const text = await page.locator("body").innerText({ timeout: 10000 });
  const html = await page.content();

  await browser.close();
  return { sessionId: session.id, title, text, html };
}
```

## Stagehand Use

Use Stagehand when selectors are unstable:

- expanding video descriptions
- transcript buttons
- modal overlays
- article pages with complex DOM

Ask Stagehand for structured extraction:

```text
title
author
publishedAt
mainClaims
embeddedVideos
citedSources
```

## Live View and Replay

Use Browserbase Live View during ingestion:

- "watch ingestion live"
- "take over" if the page needs user action
- show evidence capture steps

Use session replay after ingestion:

- evidence drawer can link to replay
- judges can inspect how source data was gathered

## Legal and Risk Notes

YouTube automation is sensitive.

Guidance:

- prefer official APIs and user-provided/authorized data
- do not bypass paywalls, DRM, login restrictions, or access controls
- treat YouTube rendering as context capture, not bulk downloading
- let users paste/upload transcripts if automated retrieval is not permitted
- keep Browserbase keys server-side
- delete recordings when no longer needed

## Prize Narrative

Browserbase turns the app from an opaque summarizer into a verifiable research tool:

> The app browses source pages, records how evidence was captured, stores screenshots/replay links, and attaches that evidence to every IBIS node.

## Implementation Plan

1. Add `/api/ingest`.
2. Add Fetch-first URL extraction.
3. Add Browserbase Playwright fallback.
4. Capture screenshots.
5. Store source/evidence records.
6. Add evidence drawer in UI.
7. Add Live View during ingestion.
8. Add replay proxy.
9. Add "Browserbase Evidence Mode" for demo.

