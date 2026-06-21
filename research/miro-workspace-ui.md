# Miro-Inspired Workspace Research

## Why Miro Is Relevant

Miro is useful as a reference because it makes complex spatial work feel lightweight:

- the canvas is the main surface
- tools are always nearby but visually secondary
- objects feel directly manipulable
- relationships are drawn as first-class lines
- AI and templates accelerate structure instead of replacing user control

For this project, we should not clone Miro visually. We should borrow the interaction grammar and adapt it to evidence-linked IBIS mapping.

Sources:

- Miro Lite online whiteboard: https://miro.com/online-whiteboard/
- Miro mind map maker: https://miro.com/mind-map/
- Miro Intelligent Canvas: https://miro.com/intelligent-canvas/

## Miro Patterns Worth Borrowing

### 1. Canvas First

Miro treats the board as the product, not a framed preview. The user enters a broad spatial surface where objects can be moved, connected, grouped, and zoomed.

Implication for us:

- The IBIS map should dominate the workspace.
- The source video/transcript and inspector should feel docked around the map, not equal dashboard panels.
- The canvas should support pan, zoom, fit-to-map, minimap, object selection, and drag.

### 2. Floating Tool Rail

Miro Lite exposes common tools in a left-side toolbar: selector, pen, templates, sticky notes, shapes, text, and connection lines. The key idea is fast object creation without large menus.

Implication for us:

Use a compact vertical tool rail on the canvas:

- select/move
- add issue
- add position
- add pro
- add con
- add decision
- add evidence/reference
- connect
- comment/note
- undo/redo

Each tool should be icon-first with a tooltip. Avoid large text buttons on the canvas.

### 3. Connection Lines Are a Core Tool

Miro describes connection lines as a way to link objects for diagrams, flowcharts, and mind maps.

Implication for us:

Edges should feel as editable and important as nodes:

- drag from handles to connect nodes
- edge label visible on selection
- edge type editable in a small popover
- invalid IBIS edge directions show a warning state
- connection mode should constrain likely valid edges where possible

### 4. Direct Manipulation Over Forms

Miro lets users select objects, move them, bulk edit, delete, copy/paste, and change formatting through contextual controls.

Implication for us:

Do not force users into a form-heavy workflow. The inspector is for detail, but the first interaction should be direct:

- click node to select
- drag node to rearrange
- double-click label to rename
- drag transcript text onto a node to attach evidence
- drag from a node handle to create an edge
- use keyboard delete/copy/paste

### 5. Sticky Notes and Cards as Thinking Units

Miro’s sticky-note metaphor works because ideas are small, movable units. For our app, IBIS nodes should feel like structured cards, not database rows.

Implication for us:

Node design should be compact:

```text
? Issue
Should cities restrict private cars downtown?
3 evidence spans · 1 warning
```

Each node should have:

- icon/symbol
- type label
- concise title
- evidence count
- confidence/review state

Avoid long quotes inside map nodes. Put quotes in the evidence drawer.

### 6. Infinite Canvas With Structure

Miro’s mind map page emphasizes expanding from a central idea without running out of space. But our product needs more discipline than free-form brainstorming.

Implication for us:

Use an issue-centered spatial layout:

- issue nodes are cluster anchors
- positions sit near the issue they answer
- pros/cons orbit the target position
- follow-up issues branch from the node they question
- reference/evidence nodes can be hidden by default and surfaced in the inspector

The canvas should feel open, but the generated first layout must be orderly.

### 7. Templates and AI as Starting Points

Miro’s AI/mind-map language is about turning messy input into a structured starting point. Miro Intelligent Canvas also emphasizes AI using canvas context and turning unstructured work into structured work.

Implication for us:

Our AI should create a draft, not a final truth:

- generated map appears with a “Draft from transcript” state
- user reviews warnings
- user accepts/rejects/splits/merges nodes
- AI actions should operate on selected canvas content

Useful AI actions:

- “Find missing objections”
- “Split overloaded node”
- “Merge duplicates”
- “Explain this cluster”
- “Create decision summary”
- “Check evidence grounding”

### 8. Lightweight Export and Share

Miro Lite supports export as PDF/JPG and simple sharing. For hackathon v1, sharing is less important than export.

Implication for us:

Add export controls in the top bar:

- JSON
- Markdown
- PNG/SVG map image

Do not build multi-user sharing yet.

## Workspace Design Direction

The app should feel like:

```text
Miro canvas + transcript evidence review + IBIS validity layer
```

Not:

```text
analytics dashboard
chatbot
generic mind map generator
video summarizer
```

Recommended layout:

```text
top bar:
  source title | generation status | validate | export | trace

left floating rail:
  select | issue | position | pro | con | decision | evidence | connect | undo | redo

left dock:
  collapsible video/audio + transcript

center:
  full canvas, grid, pan/zoom, map objects

right dock:
  selected node inspector, evidence, warnings, review actions

bottom right:
  minimap and zoom controls
```

## Visual Style Translation

Borrow:

- light, fast, spatial feel
- object-level controls
- soft shadows for selected elements
- subtle grid
- compact icons
- contextual popovers
- rounded but not overly pill-shaped controls

Do not borrow:

- bright playful sticky-note overload
- generic brainstorm templates
- collaboration reactions/polls
- oversized marketing UI
- “everything is equally free-form”

Our app should be calmer and more analytical than Miro:

- off-white or very light gray canvas
- dark text
- muted semantic node colors
- clear IBIS symbols
- restrained side panels
- evidence/warning states that feel serious

## Stage 1B Redesign Requirements

Replace the current dashboard-like shell with a Miro-inspired workspace shell.

Must change:

- Make the canvas the dominant surface.
- Move navigation from three big view buttons into a thin top status bar.
- Add a floating left tool rail.
- Replace the mock “processing dashboard” feel with a compact generation drawer or modal.
- Make the transcript/video panel collapsible.
- Make the inspector feel contextual, not like a static sidebar card.
- Use light canvas styling instead of the current heavy dark dashboard.

Keep:

- existing TypeScript contracts
- mocked demo job/transcript/graph
- Import -> Processing -> Workspace flow
- source-linked evidence concept

## Stage 1B Acceptance Criteria

The redesigned shell should make the product obvious within 5 seconds:

- User sees a large editable reasoning map.
- User sees a transcript/video evidence panel.
- User understands `?`, `!`, `+`, `-` as the core IBIS symbols.
- User can select a node and see evidence in the inspector.
- UI feels like a smooth canvas workspace, not a backend pipeline dashboard.

## Implementation Recommendation

For Stage 1B, keep the app mocked and redesign only the shell. Do not wire Deepgram yet.

After Stage 1B, install and integrate React Flow for the actual canvas editing layer.

Suggested package for Stage 2/4 canvas work:

```bash
npm install @xyflow/react
```

Use React Flow to implement:

- node dragging
- pan/zoom
- edge handles
- minimap
- controls
- fit view
- custom node types
- edge labels

