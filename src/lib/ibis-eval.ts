import Anthropic from "@anthropic-ai/sdk";
import { traced, type SpanLike } from "@/lib/trace";
import type { IbisGraph, NormalizedTranscript } from "@/lib/contracts";

// Records the eval result on the span (no-op now that Arize is removed; kept so
// the eval values still flow through evaluateIbis's return).
function setEval(span: SpanLike, name: string, label: string, score: number, explanation?: string) {
  span.setAttribute(`eval.${name}.label`, label);
  span.setAttribute(`eval.${name}.score`, score);
  if (explanation) span.setAttribute(`eval.${name}.explanation`, explanation);
}

// A stronger model than the extractor judges the output, so it can catch the
// extractor's mistakes. Override with ANTHROPIC_JUDGE_MODEL.
const JUDGE_MODEL = process.env.ANTHROPIC_JUDGE_MODEL || "claude-sonnet-4-6";

const LABELS = ["EXCELLENT", "GOOD", "PARTIAL", "POOR"] as const;
type Label = (typeof LABELS)[number];
const LABEL_SCORE: Record<Label, number> = { EXCELLENT: 1, GOOD: 0.66, PARTIAL: 0.33, POOR: 0 };

export interface DeterministicEval {
  groundingCoverage: number; // fraction of nodes with a transcript span
  orphanCount: number;
  issuePresent: boolean;
  warningCount: number;
}

export interface JudgeEval {
  grounding: { label: Label; explanation: string };
  structure: { label: Label; explanation: string };
  coverage: { label: Label; explanation: string };
  overall: Label;
  score: number; // mean of the three label scores
}

export interface IbisQuality extends DeterministicEval {
  judge?: JudgeEval;
}

export function deterministicEval(graph: IbisGraph): DeterministicEval {
  const connected = new Set<string>();
  for (const e of graph.edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const grounded = graph.nodes.filter((n) => n.transcriptSpanIds.length > 0).length;
  return {
    groundingCoverage: graph.nodes.length ? Number((grounded / graph.nodes.length).toFixed(3)) : 0,
    orphanCount: graph.nodes.filter((n) => !connected.has(n.id)).length,
    issuePresent: graph.nodes.some((n) => n.type === "issue"),
    warningCount: graph.warnings.length,
  };
}

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    grounding_label: { type: "string", enum: LABELS },
    grounding_explanation: { type: "string" },
    structure_label: { type: "string", enum: LABELS },
    structure_explanation: { type: "string" },
    coverage_label: { type: "string", enum: LABELS },
    coverage_explanation: { type: "string" },
    overall_label: { type: "string", enum: LABELS },
  },
  required: [
    "grounding_label",
    "grounding_explanation",
    "structure_label",
    "structure_explanation",
    "coverage_label",
    "coverage_explanation",
    "overall_label",
  ],
} as const;

const JUDGE_SYSTEM = `You are a strict evaluator of IBIS (Issue-Based Information System) dialogue maps extracted from debate transcripts.

Score three dimensions, each EXCELLENT / GOOD / PARTIAL / POOR:
- grounding: is every node actually supported by what was said in the transcript? Penalize invented claims, misattributed positions, or quotes that don't match. THIS IS THE MOST IMPORTANT dimension.
- structure: are the IBIS edges correct? positions should answer issues, pros should support positions, cons should object to positions. Penalize wrong directions, miscategorized node types, or arbitrary over-linking.
- coverage: does the map capture the central issue(s), the main positions, and the obvious pros/cons? Penalize missing the key objections.

Also give an overall_label. Be concise and concrete in explanations; cite specific node labels.`;

function describeGraph(graph: IbisGraph): string {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodes = graph.nodes
    .map((n) => `${n.id} [${n.type}] "${n.label}"${n.quote ? ` (quote: "${n.quote}")` : ""}`)
    .join("\n");
  const edges = graph.edges
    .map((e) => `${byId.get(e.source)?.type ?? "?"} ${e.source} --${e.type}--> ${e.target} ${byId.get(e.target)?.type ?? "?"}`)
    .join("\n");
  return `NODES:\n${nodes}\n\nEDGES:\n${edges}`;
}

export async function judgeGraph(graph: IbisGraph, transcript: NormalizedTranscript): Promise<JudgeEval> {
  const transcriptText = transcript.utterances.map((u) => `${u.id} ${u.speakerLabel}: ${u.text}`).join("\n");
  const graphText = describeGraph(graph);
  const userPrompt = `TRANSCRIPT:\n${transcriptText}\n\nIBIS MAP:\n${graphText}\n\nEvaluate the map.`;

  return traced("ibis.judge", {}, async (span) => {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 2000,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const raw = JSON.parse(text) as Record<string, Label | string>;

    const judge: JudgeEval = {
      grounding: { label: raw.grounding_label as Label, explanation: String(raw.grounding_explanation) },
      structure: { label: raw.structure_label as Label, explanation: String(raw.structure_explanation) },
      coverage: { label: raw.coverage_label as Label, explanation: String(raw.coverage_explanation) },
      overall: raw.overall_label as Label,
      score: 0,
    };
    judge.score = Number(
      ((LABEL_SCORE[judge.grounding.label] + LABEL_SCORE[judge.structure.label] + LABEL_SCORE[judge.coverage.label]) / 3).toFixed(3),
    );

    span.setAttribute("output.value", JSON.stringify(judge));
    return judge;
  });
}

export async function evaluateIbis(
  graph: IbisGraph,
  transcript: NormalizedTranscript,
  opts: { judge?: boolean } = {},
): Promise<IbisQuality> {
  return traced("ibis.evaluate", {}, async (span) => {
    const det = deterministicEval(graph);

    // Deterministic evals (run on every map) in Arize's eval.<Name>.* convention.
    setEval(span, "GroundingCoverage", det.groundingCoverage >= 0.95 ? "PASS" : "REVIEW", det.groundingCoverage);
    setEval(span, "Orphans", det.orphanCount === 0 ? "PASS" : "REVIEW", det.orphanCount);
    setEval(span, "IssuePresent", det.issuePresent ? "PASS" : "FAIL", det.issuePresent ? 1 : 0);

    let judge: JudgeEval | undefined;
    if (opts.judge) {
      judge = await judgeGraph(graph, transcript);
      setEval(span, "Grounding", judge.grounding.label, LABEL_SCORE[judge.grounding.label], judge.grounding.explanation);
      setEval(span, "Structure", judge.structure.label, LABEL_SCORE[judge.structure.label], judge.structure.explanation);
      setEval(span, "Coverage", judge.coverage.label, LABEL_SCORE[judge.coverage.label], judge.coverage.explanation);
      setEval(span, "Overall", judge.overall, judge.score);
    }

    return { ...det, judge };
  });
}
