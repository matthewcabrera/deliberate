# UI and UX Plan

## Product Goal

Turn a YouTube URL or uploaded MP4 into an editable IBIS/dialogue map grounded in transcript evidence.

The app should feel like a review workspace, not a generic AI chat app.

## Core Flow

1. Import
   - Paste YouTube/source URL.
   - Upload MP4.
   - Choose map type and extraction depth.

2. Processing
   - Fetching media/source.
   - Extracting audio.
   - Transcribing with Deepgram.
   - Extracting IBIS map.
   - Validating graph.

3. Review Workspace
   - Video/player panel.
   - Transcript panel.
   - Editable map canvas.
   - Inspector/review panel.

4. Edit and Validate
   - Rename nodes.
   - Change node type.
   - Attach evidence.
   - Add/delete edges.
   - Accept/reject AI suggestions.

5. Export
   - JSON.
   - Markdown.
   - PNG/SVG.
   - CSV nodes/edges.

## Main Workspace

```text
top bar: project title | source | review status | validate | export

left: video + transcript
center: editable map canvas
right: selected node inspector + review queue
```

Recommended desktop sizing:

- left rail: 320 to 420 px
- inspector: 320 to 380 px
- canvas: flexible

## Import Screen

Fields:

- URL input.
- MP4 dropzone.
- Map type: IBIS, Dialogue Map, Argument Map.
- Detail: Concise, Standard, Detailed.
- Speaker handling: Auto-detect, Single speaker, Manual later.

Disable submit until source is valid.

## Processing Screen

Show discrete steps:

```text
Media received
Audio extracted
Transcribing
Extracting issues and arguments
Building map
```

Keep job resumable by `jobId`.

## Map Canvas

Use React Flow-style interactions:

- pan
- zoom
- fit view
- minimap
- drag nodes
- connect handles
- edge labels
- context menu
- undo/redo

Node types:

- Issue
- Position
- Pro
- Con
- Question
- Decision
- Evidence
- Note

Node content:

```text
type label
short title
evidence count
review status
warning count
```

## Transcript and Video Sync

Required interactions:

- Click transcript segment -> seek video.
- Click map node -> seek strongest evidence timestamp.
- Video playback -> highlight active transcript segment.
- Node selection -> highlight all supporting transcript spans.
- Timeline markers show evidence spans.

Transcript actions:

- create node from selected text
- attach selected text as evidence
- edit speaker
- flag low-confidence segment

## Inspector

When a node is selected:

- type dropdown
- title field
- summary field
- evidence list with timestamps
- relationship list
- validation warnings
- review checklist

Review checklist:

```text
Label is accurate
Evidence supports this node
Relationships are correct
```

## Editing Behavior

Must-have:

- create/edit/delete nodes
- create/edit/delete edges
- change node type
- merge duplicates
- split overloaded node
- attach evidence
- mark reviewed

Validation warnings:

- missing evidence
- weak evidence
- duplicate node
- dangling edge
- invalid relationship
- low transcript confidence
- uncertain speaker

## MVP Includes

- MP4 upload.
- URL input.
- Deepgram transcript.
- generated IBIS map.
- editable canvas.
- transcript/video sync.
- evidence-linked nodes.
- review queue.
- basic export.

Defer:

- collaboration
- comments
- full mobile authoring
- custom ontology
- truth checking
- public share links

## Demo Script

1. Paste a short debate or meeting video.
2. Generate map.
3. Click first Issue node.
4. Show source evidence and timestamp.
5. Click timestamp and seek video.
6. Select transcript span and create a missing Con node.
7. Connect it to a Position.
8. Run validation.
9. Fix missing evidence warning.
10. Export Markdown and image.

