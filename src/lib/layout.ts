import type { IbisGraph } from "@/lib/contracts";

// Nodes are auto-height now; these are the layout's spacing baseline.
export const NODE_W = 248;
export const NODE_H = 104;

const H_GAP = 30;
const V_GAP = 124;
const PAD = 48;

export interface TreeLayout {
  positions: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
}

/**
 * Top-down IBIS tree layout.
 *
 * In IBIS an edge points from a child (position / pro / con) up to its parent
 * (issue / position): the source answers/supports/objects-to the target. So a
 * node that is never an edge `source` is a root (typically the issue), and we
 * lay roots out at depth 0 with their answers/arguments nested beneath them.
 *
 * Children are centered under their parent; leaves are packed left-to-right.
 */
export function computeTreeLayout(graph: IbisGraph): TreeLayout {
  const childrenOf = new Map<string, string[]>();
  const isChild = new Set<string>();

  for (const edge of graph.edges) {
    isChild.add(edge.source);
    const siblings = childrenOf.get(edge.target) ?? [];
    siblings.push(edge.source);
    childrenOf.set(edge.target, siblings);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  let cursorX = PAD;
  let maxDepth = 0;

  const place = (id: string, depth: number): number => {
    if (positions[id]) return positions[id].x; // shared child: place once
    maxDepth = Math.max(maxDepth, depth);
    const y = PAD + depth * (NODE_H + V_GAP);
    positions[id] = { x: 0, y }; // mark as visiting (cycle guard)

    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) {
      const x = cursorX;
      cursorX += NODE_W + H_GAP;
      positions[id] = { x, y };
      return x;
    }

    const centers = kids.map((kid) => place(kid, depth + 1));
    const x = (centers[0] + centers[centers.length - 1]) / 2;
    positions[id] = { x, y };
    return x;
  };

  for (const node of graph.nodes) {
    if (!isChild.has(node.id)) place(node.id, 0);
  }

  // Orphans / cycle remnants get parked in a trailing row so nothing vanishes.
  for (const node of graph.nodes) {
    if (!positions[node.id]) {
      positions[node.id] = { x: cursorX, y: PAD };
      cursorX += NODE_W + H_GAP;
    }
  }

  const width = Math.max(cursorX - H_GAP + PAD, NODE_W + PAD * 2);
  const height = PAD * 2 + (maxDepth + 1) * NODE_H + maxDepth * V_GAP;
  return { positions, width, height };
}
