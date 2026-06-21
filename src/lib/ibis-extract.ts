import Anthropic from "@anthropic-ai/sdk";
import { llmAttributes, traced } from "@/lib/trace";
import type {
  Confidence,
  EdgeType,
  IbisEdge,
  IbisGraph,
  IbisNode,
  NodeType,
  NormalizedTranscript,
} from "@/lib/contracts";

// Haiku 4.5 by default — cheap and fast enough for demo runs, and it supports
// structured outputs. Override with ANTHROPIC_MODEL (e.g. claude-opus-4-8 or
// claude-sonnet-4-6) for harder debates.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const NODE_TYPES: NodeType[] = ["issue", "position", "pro", "con", "decision", "note", "reference"];
const EDGE_TYPES: EdgeType[] = [
  "answers",
  "supports",
  "objects_to",
  "questions",
  "refers_to",
  "decides",
  "elaborates",
  "same_as",
  "relates_to",
];

const SYSTEM_PROMPT = `You convert spoken debates into IBIS (Issue-Based Information System) dialogue maps.

IBIS node types:
- issue: a question, problem, or decision point. Phrase it as a question.
- position: a proposed answer or option responding to an issue.
- pro: a reason supporting a position.
- con: an objection, risk, or cost against a position.
- decision: an accepted, rejected, or deferred outcome (only if one was actually reached).
- note: useful context that is not itself an argument.
- reference: a piece of concrete EVIDENCE — a statistic, study, source, precedent, expert, or specific verifiable fact that a speaker cites to back a position, pro, or con. Summarize it in a short phrase (e.g. "North Sea oil is 80% exported"). Create one ONLY when a speaker cites such concrete evidence, and attach it with refers_to to the claim it backs. Do not turn every assertion into evidence.

Edges are directed and MUST follow these rules:
- answers: position -> issue (the position answers the issue)
- supports: pro -> position (the pro supports the position)
- objects_to: con -> position (the con opposes the position)
- questions: issue -> any (a follow-up question arising from a node)
- decides: decision -> position (the decision adopts/rejects the position)
- refers_to: reference -> the pro, con, or position that the evidence backs
- relates_to: any -> any. Use sparingly, only when no stronger link fits.

How to map:
- Build the map around the central issue(s). Most debates have one root issue.
- Capture the argument structure, not the transcript. Do NOT create a node per utterance.
- Keep labels to a short clause. Put a representative spoken quote in "quote".
- Do not invent positions, pros, cons, or decisions that were not actually expressed. Do not infer hidden premises.
- Ground every node in evidence: set transcriptSpanIds to the utterance ids it came from (e.g. ["u3","u4"]) and speakerIds to the speaker ids (e.g. ["speaker_1"]).
- Set confidence to how clearly the speech expressed the node.
- You assign short ids: nodes "n1","n2",...; edges "e1","e2",...
- Every edge source and target MUST be ids of nodes you created. No node links to itself.

STRUCTURE — follow exactly, this is a strict tree rooted at the issue:
- Only positions attach to an issue (position -answers-> issue).
- A pro MUST attach to a POSITION via supports. A con MUST attach to a POSITION via objects_to. NEVER attach a pro or con directly to an issue. NEVER use relates_to for a pro or con.
- Every reference attaches to the position/pro/con it grounds via refers_to.
- A decision attaches to the position it adopts/rejects via decides.
- Use relates_to ONLY for a genuine weak link between two issues — never as a fallback for a pro/con/position.
- Every node except the root issue MUST be connected to its correct parent. Do not leave any node unlinked.

Return only the structured object.`;

// All fields are required so structured outputs always returns a parseable,
// shape-conformant object; unused optional fields come back empty.
const GRAPH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: NODE_TYPES },
          label: { type: "string" },
          description: { type: "string" },
          quote: { type: "string" },
          transcriptSpanIds: { type: "array", items: { type: "string" } },
          speakerIds: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["id", "type", "label", "description", "quote", "transcriptSpanIds", "speakerIds", "confidence"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: EDGE_TYPES },
          source: { type: "string" },
          target: { type: "string" },
          transcriptSpanIds: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["id", "type", "source", "target", "transcriptSpanIds", "confidence"],
      },
    },
  },
  required: ["title", "summary", "nodes", "edges"],
} as const;

interface RawNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  quote?: string;
  transcriptSpanIds?: string[];
  speakerIds?: string[];
  confidence?: Confidence;
}

interface RawEdge {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  transcriptSpanIds?: string[];
  confidence?: Confidence;
}

interface RawGraph {
  title: string;
  summary: string;
  nodes: RawNode[];
  edges: RawEdge[];
}

function secondsToClock(value: number) {
  const m = Math.floor(value / 60);
  const s = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function buildUserPrompt(transcript: NormalizedTranscript): string {
  const lines = transcript.utterances.map(
    (u) => `${u.id} [${u.speakerLabel} (${u.speakerId}) @${secondsToClock(u.startSec)}] ${u.text}`,
  );
  const summary = transcript.summary ? `Deepgram summary: ${transcript.summary}\n\n` : "";
  return `${summary}Transcript utterances:\n${lines.join("\n")}\n\nBuild the IBIS map from this debate. Cite the utterance ids above in transcriptSpanIds.`;
}

/**
 * Enforce the IBIS directional edge rules. Edges that violate the grammar or
 * reference missing nodes are dropped and recorded as warnings rather than
 * failing the whole extraction.
 */
function validateAndRepair(raw: RawGraph): { nodes: IbisNode[]; edges: IbisEdge[]; warnings: string[] } {
  const warnings: string[] = [];

  const nodes = raw.nodes.filter((n) => n.id && n.label && NODE_TYPES.includes(n.type));
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));

  const edgeOk = (e: RawEdge): boolean => {
    if (!typeById.has(e.source) || !typeById.has(e.target)) return false;
    if (e.source === e.target && e.type !== "same_as") return false;
    const s = typeById.get(e.source);
    const t = typeById.get(e.target);
    switch (e.type) {
      case "answers":
        return s === "position" && t === "issue";
      case "supports":
        return s === "pro" && t === "position";
      case "objects_to":
        return s === "con" && t === "position";
      case "questions":
        return s === "issue";
      case "decides":
        return s === "decision" && t === "position";
      default:
        return true;
    }
  };

  const keptEdges: RawEdge[] = [];
  for (const e of raw.edges) {
    if (edgeOk(e)) keptEdges.push(e);
    else warnings.push(`Dropped invalid ${e.type} edge ${e.source} -> ${e.target}.`);
  }

  if (!nodes.some((n) => n.type === "issue")) {
    warnings.push("No issue node was produced — the map has no root question.");
  }

  const ibisNodes: IbisNode[] = nodes.map((n) => {
    const confidence: Confidence = n.confidence ?? "medium";
    const nodeWarnings = confidence === "low" ? ["Low-confidence node — review the evidence."] : undefined;
    if (nodeWarnings) warnings.push(`Node ${n.id} (${n.label}) is low confidence.`);
    return {
      id: n.id,
      type: n.type,
      label: n.label,
      description: n.description || undefined,
      quote: n.quote || undefined,
      transcriptSpanIds: n.transcriptSpanIds ?? [],
      speakerIds: n.speakerIds?.length ? n.speakerIds : undefined,
      confidence,
      position: { x: 0, y: 0 }, // computed by the tree layout at render time
      createdFrom: "ai",
      warnings: nodeWarnings,
    };
  });

  const nodeById = new Map(ibisNodes.map((n) => [n.id, n]));
  const positions = ibisNodes.filter((n) => n.type === "position");
  const claims = ibisNodes.filter((n) => ["position", "pro", "con", "decision"].includes(n.type));
  const issueIds = new Set(ibisNodes.filter((n) => n.type === "issue").map((n) => n.id));
  const primaryIssue = ibisNodes.find((n) => n.type === "issue");

  const overlap = (a: string[], b: string[]) => a.filter((s) => b.includes(s)).length;
  // Pick the candidate sharing the most transcript evidence with this node.
  const bestBySpans = (node: IbisNode, candidates: IbisNode[]): IbisNode | undefined => {
    let best: IbisNode | undefined;
    let bestScore = -1;
    for (const c of candidates) {
      if (c.id === node.id) continue;
      const score = overlap(node.transcriptSpanIds, c.transcriptSpanIds);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  };

  // Keep the model's valid edges, but DROP the weak fallback pattern of a
  // pro/con/position attached to an issue via relates_to — those get re-linked
  // to the correct parent below.
  const ibisEdges: IbisEdge[] = [];
  for (const e of keptEdges) {
    const srcType = typeById.get(e.source);
    const weakFallback =
      e.type === "relates_to" &&
      issueIds.has(e.target) &&
      (srcType === "pro" || srcType === "con" || srcType === "position");
    if (weakFallback) continue;
    ibisEdges.push({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      transcriptSpanIds: e.transcriptSpanIds?.length ? e.transcriptSpanIds : undefined,
      confidence: e.confidence ?? "medium",
      createdFrom: "ai",
    });
  }

  // Every node needs its *correct* IBIS connection: positions answer the issue,
  // pros support a position, cons object to a position, evidence refers to a claim.
  const hasProperLink = (node: IbisNode): boolean => {
    const out = (type: EdgeType) =>
      ibisEdges.some((e) => e.source === node.id && e.type === type && nodeById.has(e.target));
    switch (node.type) {
      case "position":
        return ibisEdges.some((e) => e.source === node.id && e.type === "answers");
      case "pro":
        return out("supports");
      case "con":
        return out("objects_to");
      case "reference":
        return out("refers_to");
      case "decision":
        return out("decides");
      default:
        return ibisEdges.some((e) => e.source === node.id || e.target === node.id);
    }
  };

  let relinked = 0;
  ibisNodes.forEach((node, index) => {
    if (node.id === primaryIssue?.id || hasProperLink(node)) return;
    const id = `auto_${index}_${node.id}`;
    let edge: IbisEdge | undefined;

    if (node.type === "position" && primaryIssue) {
      edge = { id, type: "answers", source: node.id, target: primaryIssue.id, confidence: "low", createdFrom: "system" };
    } else if (node.type === "pro") {
      const p = bestBySpans(node, positions);
      if (p) edge = { id, type: "supports", source: node.id, target: p.id, confidence: "low", createdFrom: "system" };
    } else if (node.type === "con") {
      const p = bestBySpans(node, positions);
      if (p) edge = { id, type: "objects_to", source: node.id, target: p.id, confidence: "low", createdFrom: "system" };
    } else if (node.type === "decision") {
      const p = bestBySpans(node, positions);
      if (p) edge = { id, type: "decides", source: node.id, target: p.id, confidence: "low", createdFrom: "system" };
    } else if (node.type === "reference") {
      const c = bestBySpans(node, claims) ?? primaryIssue;
      if (c) edge = { id, type: "refers_to", source: node.id, target: c.id, confidence: "low", createdFrom: "system" };
    }

    // Last resort (e.g. a pro/con with no positions, or a stray note/sub-issue).
    if (!edge && primaryIssue) {
      edge = { id, type: "relates_to", source: node.id, target: primaryIssue.id, confidence: "low", createdFrom: "system" };
    }
    if (edge) {
      ibisEdges.push(edge);
      relinked += 1;
    }
  });
  if (relinked) warnings.push(`Re-linked ${relinked} node(s) to their correct IBIS parent.`);

  return { nodes: ibisNodes, edges: ibisEdges, warnings };
}

function extractJson(message: Anthropic.Message): RawGraph {
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) throw new Error("Anthropic returned no text content.");
  try {
    return JSON.parse(text) as RawGraph;
  } catch {
    // Defensive: strip a markdown fence if structured output was not honored.
    const fenced = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(fenced) as RawGraph;
  }
}

export async function extractIbisGraph(transcript: NormalizedTranscript): Promise<IbisGraph> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set (add it to .env.local).");
  }
  if (!transcript.utterances.length) {
    throw new Error("Transcript has no utterances to map.");
  }

  const client = new Anthropic();
  const userPrompt = buildUserPrompt(transcript);

  return traced("ibis.extract", llmAttributes(MODEL, userPrompt, ""), async (span) => {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: { type: "json_schema", schema: GRAPH_SCHEMA } },
    });

    if (message.stop_reason === "refusal") {
      throw new Error("The model declined to map this transcript.");
    }

    const raw = extractJson(message);
    const { nodes, edges, warnings } = validateAndRepair(raw);

    const graph: IbisGraph = {
      type: "ibis_graph",
      version: 1,
      title: raw.title || transcript.summary || "IBIS map",
      summary: raw.summary || undefined,
      sourceId: transcript.source.id,
      nodes,
      edges,
      warnings,
    };

    const byType = (t: NodeType) => nodes.filter((n) => n.type === t).length;
    span.setAttributes({
      "output.value": JSON.stringify(graph),
      "ibis.node_count": nodes.length,
      "ibis.edge_count": edges.length,
      "ibis.issue_count": byType("issue"),
      "ibis.position_count": byType("position"),
      "ibis.evidence_count": byType("reference"),
      "ibis.warning_count": warnings.length,
      "ibis.auto_linked": edges.filter((e) => e.createdFrom === "system").length,
      "llm.token_count.prompt": message.usage?.input_tokens,
      "llm.token_count.completion": message.usage?.output_tokens,
      "llm.token_count.total": message.usage
        ? message.usage.input_tokens + message.usage.output_tokens
        : undefined,
    });

    return graph;
  });
}
