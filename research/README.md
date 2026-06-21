# Research Packet: Video to IBIS Map

This folder contains implementation notes from five focused research tracks:

- `deepgram-integration.md`: voice/transcription architecture and prize strategy.
- `ibis-notation.md`: IBIS node/edge notation, validation rules, and map schema.
- `ui-ux-plan.md`: web app workflow and review workspace design.
- `arize-phoenix-plan.md`: tracing, evals, LLM judge, and improvement loop.
- `browserbase-plan.md`: source ingestion, evidence capture, replay, and prize strategy.

## Recommended Product Direction

Build a work tool, not an art-only visualization:

```text
MP4 or YouTube/source URL
  -> media/source ingestion
  -> Deepgram transcript with speakers, utterances, timestamps
  -> LLM extracts IBIS graph
  -> Arize Phoenix traces and evaluates the extraction
  -> editable 2D IBIS map with evidence attached to every node
```

## Sponsor Stack Priority

### Tier 1

1. **Deepgram**
   - Core speech layer.
   - Essential for the voice prize.
   - Use diarization, utterances, timestamps, confidence, and optional voice commands.

2. **Anthropic**
   - Graph extraction and critique.
   - Convert normalized transcript utterances into IBIS nodes and edges.

3. **Arize Phoenix**
   - Observability and evaluation.
   - Trace the whole pipeline and show before/after improvement from LLM judges.

### Tier 2

4. **Browserbase**
   - Strong if the app ingests YouTube/source pages.
   - Use as evidence capture: screenshots, source context, Live View, replay, and traceability.

5. **Redis**
   - Useful persistence/cache layer if implementation expands.
   - Store jobs, transcript chunks, graph state, and evidence lookup.

## MVP Scope

First demo should support:

- MP4 upload.
- Optional YouTube/source URL input if legal/permitted ingestion path is clear.
- Deepgram transcript with timestamped utterances.
- LLM-generated IBIS draft.
- React Flow-style editable map.
- Node inspector with exact transcript evidence.
- Phoenix trace and evaluation for one pipeline run.

Defer:

- TouchDesigner output.
- Multi-user collaboration.
- Long videos.
- full YouTube downloading.
- Enterprise auth.

## Prize Narratives

### Deepgram

"Voice is not an input afterthought. Every map node is grounded in timed speech: speaker, quote, timestamp, confidence, and replayable audio."

### Arize

"We do not just generate a graph. We trace every pipeline stage, judge graph quality, collect feedback, and use Phoenix experiments to improve extraction."

### Browserbase

"Browserbase is the trust layer. It captures source context, screenshots, session replay, and evidence trails so every map claim can be inspected."

## One-Week Build Order

1. Build backend job pipeline.
2. Add Deepgram transcription and normalize utterances.
3. Define IBIS schema and deterministic validators.
4. Add LLM extraction.
5. Render/edit map with source-linked nodes.
6. Add Phoenix tracing and one LLM judge.
7. Add sponsor demo polish: voice replay, review queue, trace screenshots.

