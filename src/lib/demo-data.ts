import type { IbisGraph, NormalizedTranscript, PipelineJob } from "@/lib/contracts";
import demoMap from "./demo-map.json";

export const demoYoutubeUrl = "https://www.youtube.com/watch?v=lu0ic3L3Z3k";

export const demoJob: PipelineJob = {
  id: "job_demo_youtube",
  title: "Curated YouTube debate",
  status: "ready",
  createdAt: "2026-06-20T20:30:00.000Z",
  updatedAt: "2026-06-20T20:35:00.000Z",
  traceId: "phoenix-demo-trace",
  source: {
    id: "src_demo_youtube",
    inputUrl: demoYoutubeUrl,
    canonicalUrl: demoYoutubeUrl,
    sourceType: "youtube",
    title: "Short debate video",
    fetchedAt: "2026-06-20T20:31:00.000Z",
  },
  steps: [
    {
      id: "source_capture",
      label: "Source capture",
      status: "complete",
      detail: "Source context and metadata captured.",
    },
    {
      id: "audio_extract",
      label: "Audio extraction",
      status: "complete",
      detail: "Permitted demo audio normalized for transcription.",
    },
    {
      id: "deepgram_transcribe",
      label: "Deepgram transcription",
      status: "complete",
      detail: "Speaker-timed utterances with confidence scores.",
    },
    {
      id: "ibis_extract",
      label: "IBIS extraction",
      status: "complete",
      detail: "Anthropic converted utterances into issue-centered nodes.",
    },
    {
      id: "ibis_validate",
      label: "Graph validation",
      status: "warning",
      detail: "One low-confidence evidence span needs review.",
    },
    {
      id: "map_build",
      label: "Map build",
      status: "complete",
      detail: "Editable workspace payload is ready.",
    },
  ],
  artifacts: [
    { kind: "source", label: "Source capture", path: "data/jobs/job_demo_youtube/source.json" },
    { kind: "audio", label: "Extracted source audio", path: "data/jobs/job_demo_youtube/audio/source.wav" },
    { kind: "transcript", label: "Normalized Deepgram transcript", path: "data/jobs/job_demo_youtube/transcript.json" },
    { kind: "graph", label: "Validated IBIS graph", path: "data/jobs/job_demo_youtube/graph.json" },
    { kind: "trace", label: "Phoenix trace", path: "phoenix-demo-trace" },
  ],
};

// Real map generated once from the LBC debate (Environmentalist vs Republican),
// saved in demo-map.json. Every node is grounded in transcript utterances with
// real timestamps, so clicking a node seeks the video. Powers "see an example".
export const demoTranscript = demoMap.transcript as unknown as NormalizedTranscript;

export const demoGraph = demoMap.graph as unknown as IbisGraph;
