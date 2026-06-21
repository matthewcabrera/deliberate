# IBIS and Dialogue Mapping Notation

## Principle

IBIS is a lightweight discourse map, not a formal proof system. It should capture:

- what question is being answered
- what possible answers were proposed
- what reasons support or object to those answers
- what follow-up questions emerged
- what, if anything, was decided

Do not force every sentence into a node.

Sources:

- IBIS overview: https://en.wikipedia.org/wiki/Issue-based_information_system
- Compendium: https://en.wikipedia.org/wiki/Compendium_%28software%29

## Canonical Node Types

| Type | User Label | Purpose |
|---|---|---|
| `issue` | Question | A question, problem, uncertainty, or decision point |
| `position` | Idea | A possible answer to an issue |
| `pro` | Pro | A reason supporting a position |
| `con` | Con | A reason objecting to a position |

## Useful Product Extensions

| Type | Purpose |
|---|---|
| `decision` | Accepted, rejected, deferred, or superseded outcome |
| `note` | Useful context that is not yet IBIS-shaped |
| `reference` | Transcript quote, URL, timestamp, screenshot, document, or source |
| `map` | Collapsed nested sub-map |
| `list` | Ordered agenda/action/reference list |

MVP should implement:

```text
issue, position, pro, con, decision, note, reference
```

## Visual Symbols

| Type | Symbol | Shape | Color Role |
|---|---|---|---|
| `issue` | `?` | circle or pill | blue |
| `position` | lightbulb or `!` | rounded rectangle | amber |
| `pro` | `+` | rounded rectangle | green |
| `con` | `-` | rounded rectangle | red |
| `decision` | check | badge or hexagon | violet |
| `note` | note | rectangle | gray |
| `reference` | link/file | document rectangle | teal |

Do not rely on color alone. Show icon and type label.

## Edge Semantics

IBIS links are directed.

| Edge | Direction | Meaning |
|---|---|---|
| `answers` | `position -> issue` | This idea answers this question |
| `supports` | `pro -> position` | This reason supports this idea |
| `objects_to` | `con -> position` | This reason opposes this idea |
| `questions` | `issue -> any` | This follow-up question arises from a node |

Useful extensions:

| Edge | Direction | Meaning |
|---|---|---|
| `refers_to` | `reference -> any` | Source material grounds a node |
| `decides` | `decision -> position` | Decision adopts/rejects/defers a position |
| `elaborates` | `any -> any` | Adds detail without argumentative force |
| `same_as` | `any -> any` | Duplicate or merge candidate |
| `relates_to` | `any -> any` | Weak or unresolved association |

Avoid overusing `relates_to`.

## Layout Rules

1. Place `issue` nodes as cluster anchors.
2. Place `position` nodes to the right or below the issue they answer.
3. Place `pro` and `con` nodes around their target position.
4. Place follow-up `issue` nodes near the node they question.
5. Keep transcript chronology as metadata, not as the main layout.
6. Prefer issue-centered clusters over a force-directed hairball.
7. Preserve manual node positions after user edits.

## Validation Rules

Hard rules:

- `answers` must be `position -> issue`.
- `supports` must be `pro -> position`.
- `objects_to` must be `con -> position`.
- `questions` must be `issue -> any`.
- Every edge source and target must exist.
- No self-links except merge/same-as candidates.

Soft warnings:

- `issue` labels should usually be questions.
- `position` labels should be concise proposals.
- `pro` and `con` labels should be reasons, not yes/no markers.
- Long quotes should become `reference` nodes, not main argument nodes.
- Low-confidence AI nodes should enter a review queue.

## Minimal Schema

```ts
type NodeType =
  | "issue"
  | "position"
  | "pro"
  | "con"
  | "decision"
  | "note"
  | "reference";

type EdgeType =
  | "answers"
  | "supports"
  | "objects_to"
  | "questions"
  | "refers_to"
  | "decides"
  | "elaborates"
  | "same_as"
  | "relates_to";

type Confidence = "low" | "medium" | "high";

interface IbisNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  speakerIds?: string[];
  transcriptSpanIds?: string[];
  quote?: string;
  timestampStartMs?: number;
  timestampEndMs?: number;
  confidence: Confidence;
  position: { x: number; y: number };
  createdFrom: "ai" | "human" | "import" | "system";
}

interface IbisEdge {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  confidence: Confidence;
  transcriptSpanIds?: string[];
  createdFrom: "ai" | "human" | "import" | "system";
}
```

## AI Mapping Rules

Create `issue` when an utterance:

- asks a question
- reveals uncertainty
- frames a decision
- challenges a prior idea in question form

Create `position` when an utterance proposes:

- an answer
- a solution
- an option
- a plan

Create `pro` when an utterance gives:

- a benefit
- a reason
- supporting evidence
- an enabling condition

Create `con` when an utterance gives:

- a risk
- an objection
- a blocker
- a cost
- a counterexample

Anti-overformalization:

- Do not create a node for every utterance.
- Do not infer hidden premises unless they were materially expressed.
- Do not turn casual agreement into `pro` unless it adds a reason.
- Do not invent decisions from silence or topic shifts.
- Keep labels short and put longer evidence in references.

