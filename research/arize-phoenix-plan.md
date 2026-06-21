# Arize Phoenix Observability and Evaluation Plan

## Goal

Use Arize Phoenix to make the pipeline observable and improvable:

```text
MP4/YouTube
  -> Deepgram transcript
  -> LLM IBIS extraction
  -> validation/repair
  -> editable map
```

Prize story:

> We traced the full AI pipeline, created LLM judges for IBIS graph quality, used feedback to improve prompts/schema, and documented before/after quality.

Sources:

- Phoenix docs: https://arize.com/docs/phoenix
- Tracing setup: https://arize.com/docs/phoenix/get-started/get-started-tracing
- LLM-as-judge: https://arize.com/docs/phoenix/evaluation/concepts-evals/llm-as-a-judge
- Datasets/experiments: https://arize.com/docs/phoenix/datasets-and-experiments

## What to Trace

One root trace per video/source job:

```text
ibis.pipeline
  media.ingest
  audio.extract
  transcript.deepgram
  transcript.chunk
  ibis.extract_graph
  ibis.validate_graph
  ibis.repair_graph
  map.render_payload
  user.feedback
```

Key attributes:

- source type
- media duration
- Deepgram model
- utterance count
- speaker count
- average transcript confidence
- LLM model
- prompt version
- schema version
- node count
- edge count
- orphan count
- invalid edge count
- latency
- token cost

## Setup

```bash
pip install "arize-phoenix-otel>=0.16.0" arize-phoenix-client arize-phoenix-evals
```

Environment:

```bash
PHOENIX_API_KEY=...
PHOENIX_COLLECTOR_ENDPOINT=...
DEEPGRAM_API_KEY=...
ANTHROPIC_API_KEY=...
```

App startup:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="ibis-video-map",
    auto_instrument=True,
)
```

## Custom Span Shape

```python
from opentelemetry import trace

tracer = trace.get_tracer("ibis-video-map")

def run_pipeline(media_input, source_type, prompt_version, model):
    with tracer.start_as_current_span("ibis.pipeline") as root:
        root.set_attribute("app.source_type", source_type)
        root.set_attribute("app.prompt_version", prompt_version)
        root.set_attribute("app.model", model)

        audio = extract_audio(media_input)
        transcript = transcribe_with_deepgram(audio)
        chunks = chunk_transcript(transcript)
        graph = extract_ibis_graph(chunks)
        validation = validate_ibis_graph(graph)
        payload = make_editable_map_payload(graph)

        root.set_attribute("ibis.node_count", len(payload["nodes"]))
        root.set_attribute("ibis.edge_count", len(payload["edges"]))
        root.set_attribute("ibis.schema_valid", validation["schema_valid"])
        return payload
```

## Evaluators

Use both deterministic and LLM judges.

Deterministic:

- schema validity
- edge integrity
- minimum IBIS shape
- quote/timestamp presence
- orphan node count

LLM judges:

1. IBIS graph quality
   - correct node types
   - useful questions/positions/pros/cons
   - concise labels
   - editable output

2. Source grounding
   - each important node is supported by transcript quotes/timestamps
   - no invented claims

3. Relationship quality
   - support/object/answer edges are correct
   - no arbitrary over-linking

4. Coverage
   - captures central issues and major positions
   - does not miss obvious objections

## LLM Judge Rubric

Labels:

```text
EXCELLENT = accurate, grounded, useful with minor/no edits
GOOD = mostly accurate, small omissions or relationship errors
PARTIAL = useful fragments, but needs substantial editing
POOR = invalid, hallucinated, or not useful
```

Criteria:

- IBIS structure
- coverage
- grounding
- relationship quality
- concision
- editability
- no hallucination

## Feedback Loop

1. Trace every run.
2. Save `span_id` with returned map.
3. Add UI feedback:
   - thumbs up/down
   - missing key point
   - wrong relationship
   - hallucinated claim
   - bad transcript
4. Log feedback as Phoenix annotations.
5. Turn bad traces into regression examples.
6. Run experiments on prompt/schema variants.
7. Show before/after metrics.

## Demo Narrative

1. Run a video through the app.
2. Open Phoenix trace tree.
3. Show `transcript.deepgram` span.
4. Show `ibis.extract_graph` span with prompt/output.
5. Show validation/eval annotations.
6. Show one bad output.
7. Show how judge feedback led to prompt/schema change.
8. Show improved experiment score.

## Prize Checklist

- Phoenix trace screenshot.
- Deepgram span screenshot.
- LLM extraction span screenshot.
- LLM judge rubric.
- Evaluation result screenshot.
- Before/after metrics table.
- Explanation of prompt/schema improvement from Phoenix.
- Privacy note: demo media only, hashed identifiers, no private raw media in traces.

