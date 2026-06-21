"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  NodeToolbar,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Check,
  ChevronLeft,
  CircleHelp,
  Lightbulb,
  Minus,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Quote,
  Redo2,
  Spline,
  Undo2,
  Video,
  VideoOff,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { demoGraph, demoTranscript } from "@/lib/demo-data";
import VideoPanel, { type MediaSource, type SeekFn } from "@/components/VideoPanel";
import { NODE_H, NODE_W, computeTreeLayout } from "@/lib/layout";
import type {
  EdgeType,
  IbisGraph,
  NodeType,
  NormalizedTranscript,
  SpeakerProfile,
} from "@/lib/contracts";

const nodeStyles: Record<NodeType, { label: string; symbol: string }> = {
  issue: { label: "Issue", symbol: "?" },
  position: { label: "Position", symbol: "!" },
  pro: { label: "Pro", symbol: "+" },
  con: { label: "Con", symbol: "−" },
  decision: { label: "Decision", symbol: "✓" },
  note: { label: "Note", symbol: "·" },
  reference: { label: "Evidence", symbol: "" },
};

function secondsLabel(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

interface IbisNodeData extends Record<string, unknown> {
  ntype: NodeType;
  label: string;
  quote?: string;
  timestamp?: string;
  speaker?: string;
  startSec?: number;
}

type IbisFlowNode = Node<IbisNodeData, "ibis">;

function nodeBadge(ntype: NodeType) {
  if (ntype === "position") return <Lightbulb aria-hidden="true" />;
  if (ntype === "reference") return <Quote aria-hidden="true" />;
  return nodeStyles[ntype].symbol;
}

// --- Custom IBIS node: the mark, the editable claim, and a grounding popup ---

function IbisFlowNode({ id, data, selected }: NodeProps<IbisFlowNode>) {
  const grounded = Boolean(data.quote || data.timestamp);
  const { setNodes } = useReactFlow<IbisFlowNode>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== data.label) {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: next } } : n)));
    }
  };

  return (
    <div className={`node rf-node ${data.ntype} ${selected ? "selected" : ""}`} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Bottom} className="rf-handle" />
      <span className="node-badge" aria-hidden="true">
        {nodeBadge(data.ntype)}
      </span>
      <span className="node-body">
        {editing ? (
          <textarea
            className="node-edit nodrag nowheel"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(data.label);
                setEditing(false);
              }
            }}
          />
        ) : (
          <strong
            onDoubleClick={() => {
              setDraft(data.label);
              setEditing(true);
            }}
          >
            {data.label}
          </strong>
        )}
      </span>
      <Handle type="source" position={Position.Top} className="rf-handle" />

      {grounded && !editing && (
        <NodeToolbar isVisible={selected} position={Position.Bottom} offset={10} className="ground-popup">
          {data.timestamp && (
            <span className="ground-time">
              {data.timestamp}
              {data.speaker ? ` · ${data.speaker}` : ""}
            </span>
          )}
          {data.quote && <p className="ground-quote">“{data.quote}”</p>}
        </NodeToolbar>
      )}
    </div>
  );
}

const nodeTypes = { ibis: IbisFlowNode };

const relationByType: Record<NodeType, EdgeType> = {
  issue: "relates_to",
  position: "answers",
  pro: "supports",
  con: "objects_to",
  decision: "decides",
  note: "relates_to",
  reference: "refers_to",
};

function speakerNameMap(transcript: NormalizedTranscript): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of transcript.speakers ?? []) m[p.id] = p.editableName || p.inferredName || p.label;
  for (const u of transcript.utterances) if (!m[u.speakerId]) m[u.speakerId] = u.speakerLabel;
  return m;
}

// Each node carries the timestamp + verbatim quote that grounds it in the source.
function buildInitialGraph(graph: IbisGraph, transcript: NormalizedTranscript): { nodes: IbisFlowNode[]; edges: Edge[] } {
  const layout = computeTreeLayout(graph);
  const names = speakerNameMap(transcript);

  const nodes: IbisFlowNode[] = graph.nodes.map((node) => {
    const utts = transcript.utterances.filter((u) => node.transcriptSpanIds.includes(u.id));
    const lead = utts[0];
    const quote = lead?.text ?? node.quote;
    const timestamp = lead
      ? secondsLabel(lead.startSec)
      : node.timestampStartMs != null
        ? secondsLabel(node.timestampStartMs / 1000)
        : undefined;
    const speaker = lead ? names[lead.speakerId] : node.speakerIds?.[0] ? names[node.speakerIds[0]] : undefined;

    return {
      id: node.id,
      type: "ibis",
      position: layout.positions[node.id] ?? { x: 0, y: 0 },
      data: { ntype: node.type, label: node.label, quote, timestamp, speaker, startSec: lead?.startSec },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => styleEdge(edge.id, edge.source, edge.target, edge.type));
  return { nodes, edges };
}

// Edges carry no labels — the marks and the lines speak for themselves.
function styleEdge(id: string, source: string, target: string, rel: EdgeType): Edge {
  const objection = rel === "objects_to";
  return {
    id,
    source,
    target,
    style: {
      stroke: "var(--ink-40)",
      strokeWidth: 1.5,
      strokeDasharray: objection ? "5 4" : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#4a443c", width: 15, height: 15 },
  };
}

// --- Tool rail --------------------------------------------------------------

const addableTools: { type: NodeType; icon: typeof Plus; title: string }[] = [
  { type: "issue", icon: CircleHelp, title: "Add issue" },
  { type: "position", icon: Lightbulb, title: "Add position" },
  { type: "pro", icon: Plus, title: "Add pro" },
  { type: "con", icon: Minus, title: "Add con" },
  { type: "decision", icon: Check, title: "Add decision" },
  { type: "reference", icon: Quote, title: "Add evidence" },
];

// --- Inner canvas (needs ReactFlow context) --------------------------------

function Canvas({
  graph,
  transcript,
  media,
  onExit,
}: {
  graph: IbisGraph;
  transcript: NormalizedTranscript;
  media?: MediaSource;
  onExit?: () => void;
}) {
  const initial = useMemo(() => buildInitialGraph(graph, transcript), [graph, transcript]);

  // The video player registers its seek function here; clicking a node jumps
  // the video to that node's source timestamp.
  const seekRef = useRef<SeekFn | null>(null);
  const registerSeek = useCallback((fn: SeekFn) => {
    seekRef.current = fn;
  }, []);
  const sourceTitle = transcript.source.title ?? "Untitled source";
  const sourceType = transcript.source.sourceType;

  // Speaker names: inferred where possible, editable in the dock. The map
  // (id -> display name) drives both the transcript and the inspector.
  const speakerProfiles: SpeakerProfile[] = useMemo(() => {
    if (transcript.speakers?.length) return transcript.speakers;
    const seen = new Map<string, string>();
    for (const u of transcript.utterances) {
      if (!seen.has(u.speakerId)) seen.set(u.speakerId, u.speakerLabel);
    }
    return [...seen].map(([id, label]) => ({ id, label, confidence: "low" as const }));
  }, [transcript]);

  const defaultNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of speakerProfiles) m[p.id] = p.editableName || p.inferredName || p.label;
    return m;
  }, [speakerProfiles]);

  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const nameFor = (speakerId: string, fallback: string) =>
    nameOverrides[speakerId] ?? defaultNames[speakerId] ?? fallback;
  const [nodes, setNodes, onNodesChange] = useNodesState<IbisFlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(true);

  const { screenToFlowPosition } = useReactFlow();
  const idCounter = useRef(1);

  type Snapshot = { nodes: IbisFlowNode[]; edges: Edge[] };
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  const snapshot = useCallback(() => {
    setPast((p) => [...p, { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture((f) => [...f, { nodes, edges }]);
    setPast((p) => p.slice(0, -1));
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [past, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setPast((p) => [...p, { nodes, edges }]);
    setFuture((f) => f.slice(0, -1));
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future, nodes, edges, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const target = nodes.find((n) => n.id === connection.target);
      const rel = target ? relationByType[target.data.ntype] : "relates_to";
      snapshot();
      setEdges((eds) =>
        addEdge(styleEdge(`e_${connection.source}_${connection.target}`, connection.source!, connection.target!, rel), eds),
      );
    },
    [nodes, setEdges, snapshot],
  );

  const addNode = useCallback(
    (ntype: NodeType) => {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const id = `new_${idCounter.current++}`;
      snapshot();
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: "ibis",
          position: { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 },
          data: { ntype, label: `New ${nodeStyles[ntype].label.toLowerCase()}` },
        },
      ]);
    },
    [screenToFlowPosition, setNodes, snapshot],
  );

  return (
    <div className={`workspace-shell ${transcriptOpen ? "" : "transcript-collapsed"}`}>
      {/* Top status bar */}
      <div className="ws-statusbar">
        <div className="ws-source">
          {onExit && (
            <button type="button" className="icon-button" onClick={onExit} title="Back to menu">
              <ChevronLeft aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={() => setTranscriptOpen((v) => !v)}
            title={transcriptOpen ? "Hide transcript" : "Show transcript"}
          >
            {transcriptOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
          </button>
          {media && (
            <button
              type="button"
              className={`icon-button ${videoOpen ? "active" : ""}`}
              onClick={() => setVideoOpen((v) => !v)}
              title={videoOpen ? "Hide video" : "Show video"}
            >
              {videoOpen ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}
            </button>
          )}
          <div>
            <p className="eyebrow">{sourceType} source</p>
            <strong>{sourceTitle}</strong>
          </div>
        </div>
      </div>

      {media && videoOpen && (
        <div className="ws-stage-top">
          <VideoPanel media={media} registerSeek={registerSeek} />
        </div>
      )}

      <div className="ws-body">
        {/* Left transcript dock */}
        {transcriptOpen && (
          <aside className="ws-dock">
            {speakerProfiles.length > 0 && (
              <div className="speakers">
                {speakerProfiles.map((p, index) => (
                  <div key={p.id} className="speaker-row">
                    <span className="glyph">{index + 1}</span>
                    <input
                      className="speaker-input"
                      value={nameFor(p.id, p.label)}
                      onChange={(e) => setNameOverrides((s) => ({ ...s, [p.id]: e.target.value }))}
                      aria-label={`Name for ${p.label}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="transcript-list">
              {transcript.utterances.map((u) => (
                <div key={u.id} className="transcript-segment">
                  <span>
                    {secondsLabel(u.startSec)} · {nameFor(u.speakerId, u.speakerLabel)}
                  </span>
                  <p>{u.text}</p>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center canvas */}
        <div className="ws-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              if (media && videoOpen && node.data.startSec != null) seekRef.current?.(node.data.startSec);
            }}
            fitView
            fitViewOptions={{ padding: 0.28 }}
            minZoom={0.2}
            maxZoom={1.75}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="rgba(27,23,19,0.14)" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor="rgba(27,23,19,0.45)" maskColor="rgba(243,239,229,0.6)" />

            {/* Floating tool rail */}
            <Panel position="top-left" className="tool-rail">
              <button type="button" className="rail-tool active" title="Select / move">
                <MousePointer2 aria-hidden="true" />
              </button>
              <span className="rail-divider" />
              {addableTools.map((tool) => (
                <button
                  key={tool.type}
                  type="button"
                  className="rail-tool"
                  title={tool.title}
                  onClick={() => addNode(tool.type)}
                >
                  <tool.icon aria-hidden="true" />
                </button>
              ))}
              <span className="rail-divider" />
              <button type="button" className="rail-tool" title="Connect (drag node handles)">
                <Spline aria-hidden="true" />
              </button>
              <span className="rail-divider" />
              <button
                type="button"
                className="rail-tool"
                title="Undo"
                onClick={undo}
                disabled={past.length === 0}
              >
                <Undo2 aria-hidden="true" />
              </button>
              <button
                type="button"
                className="rail-tool"
                title="Redo"
                onClick={redo}
                disabled={future.length === 0}
              >
                <Redo2 aria-hidden="true" />
              </button>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function Workspace({
  graph,
  transcript,
  media,
  onExit,
}: {
  graph?: IbisGraph;
  transcript?: NormalizedTranscript;
  media?: MediaSource;
  onExit?: () => void;
}) {
  return (
    <ReactFlowProvider>
      <Canvas graph={graph ?? demoGraph} transcript={transcript ?? demoTranscript} media={media} onExit={onExit} />
    </ReactFlowProvider>
  );
}
