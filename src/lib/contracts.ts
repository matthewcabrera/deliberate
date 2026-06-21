export type SourceType = "youtube" | "upload" | "transcript" | "webpage" | "unknown";

export type PipelineStepId =
  | "source_capture"
  | "audio_extract"
  | "deepgram_transcribe"
  | "ibis_extract"
  | "ibis_validate"
  | "map_build";

export type PipelineStepStatus = "pending" | "running" | "complete" | "warning" | "error";

export type NodeType = "issue" | "position" | "pro" | "con" | "decision" | "note" | "reference";

export type EdgeType =
  | "answers"
  | "supports"
  | "objects_to"
  | "questions"
  | "refers_to"
  | "decides"
  | "elaborates"
  | "same_as"
  | "relates_to";

export type Confidence = "low" | "medium" | "high";

export type ArtifactKind = "source" | "audio" | "transcript" | "graph" | "trace" | "export";

export interface SourceRecord {
  id: string;
  inputUrl: string;
  canonicalUrl?: string;
  sourceType: SourceType;
  title?: string;
  fetchedAt?: string;
  browserbaseSessionId?: string;
  screenshotPath?: string;
}

export interface TranscriptWord {
  text: string;
  startSec: number;
  endSec: number;
  confidence?: number;
}

export interface TranscriptUtterance {
  id: string;
  speakerId: string;
  speakerLabel: string;
  startSec: number;
  endSec: number;
  confidence: number;
  text: string;
  words?: TranscriptWord[];
}

export interface SpeakerProfile {
  id: string;
  label: string;
  inferredName?: string;
  editableName?: string;
  confidence: Confidence;
}

export interface NormalizedTranscript {
  type: "normalized_transcript";
  version: 1;
  source: SourceRecord;
  durationSec?: number;
  deepgramRequestId?: string;
  summary?: string;
  speakers?: SpeakerProfile[];
  utterances: TranscriptUtterance[];
  fullText: string;
}

export interface IbisNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  speakerIds?: string[];
  transcriptSpanIds: string[];
  quote?: string;
  timestampStartMs?: number;
  timestampEndMs?: number;
  confidence: Confidence;
  position: {
    x: number;
    y: number;
  };
  createdFrom: "ai" | "human" | "import" | "system";
  reviewed?: boolean;
  warnings?: string[];
}

export interface IbisEdge {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  confidence: Confidence;
  transcriptSpanIds?: string[];
  createdFrom: "ai" | "human" | "import" | "system";
  warnings?: string[];
}

export interface IbisGraph {
  type: "ibis_graph";
  version: 1;
  title: string;
  summary?: string;
  sourceId: string;
  nodes: IbisNode[];
  edges: IbisEdge[];
  warnings: string[];
}

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: PipelineStepStatus;
  detail?: string;
}

export interface PipelineArtifact {
  kind: ArtifactKind;
  label: string;
  path?: string;
  updatedAt?: string;
}

export interface PipelineJob {
  id: string;
  title: string;
  status: "draft" | "queued" | "running" | "ready" | "error";
  source: SourceRecord;
  steps: PipelineStep[];
  artifacts: PipelineArtifact[];
  traceId?: string;
  createdAt: string;
  updatedAt: string;
}
