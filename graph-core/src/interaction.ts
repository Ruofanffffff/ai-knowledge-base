export interface GraphInteractionState {
  query: string;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
}

export type GraphInteractionEvent =
  | { type: 'setQuery'; query: string }
  | { type: 'clearQuery' }
  | { type: 'hoverNode'; nodeId: string | null }
  | { type: 'selectNode'; nodeId: string }
  | { type: 'toggleNode'; nodeId: string }
  | { type: 'clearSelection' }
  | { type: 'reset' };

export function createGraphInteractionState(
  seed?: Partial<GraphInteractionState>
): GraphInteractionState {
  return {
    query: seed?.query ?? '',
    hoveredNodeId: seed?.hoveredNodeId ?? null,
    selectedNodeId: seed?.selectedNodeId ?? null,
  };
}

export function reduceGraphInteractionState(
  state: GraphInteractionState,
  event: GraphInteractionEvent
): GraphInteractionState {
  switch (event.type) {
    case 'setQuery':
      return { ...state, query: event.query ?? '' };
    case 'clearQuery':
      return { ...state, query: '' };
    case 'hoverNode':
      return { ...state, hoveredNodeId: event.nodeId ?? null };
    case 'selectNode':
      return { ...state, selectedNodeId: event.nodeId };
    case 'toggleNode':
      return { ...state, selectedNodeId: state.selectedNodeId === event.nodeId ? null : event.nodeId };
    case 'clearSelection':
      return { ...state, selectedNodeId: null };
    case 'reset':
      return createGraphInteractionState();
    default:
      return state;
  }
}

export interface GraphSearchableNode {
  id: string;
  label?: string;
  name?: string;
  description?: string;
}

export function computeMatchedNodeIds(
  nodes: ReadonlyArray<GraphSearchableNode>,
  query: string
): Set<string> | null {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return null;

  const out = new Set<string>();
  for (const n of nodes) {
    const label = String(n.label ?? n.name ?? '').toLowerCase();
    const desc = String(n.description ?? '').toLowerCase();
    if (label.includes(q) || desc.includes(q)) out.add(n.id);
  }
  return out.size ? out : new Set<string>();
}

export interface GraphSimpleLink {
  source: string;
  target: string;
}

export function getConnectedNodeIds(
  links: ReadonlyArray<GraphSimpleLink>,
  nodeId: string
): Set<string> {
  const out = new Set<string>();
  for (const l of links) {
    if (l.source === nodeId) out.add(l.target);
    if (l.target === nodeId) out.add(l.source);
  }
  out.add(nodeId);
  return out;
}

export function computeDimmedNodeIds(
  allNodeIds: ReadonlyArray<string>,
  matchedNodeIds: Set<string> | null,
  connectedNodeIds: Set<string> | null
): Set<string> | null {
  const dim = new Set<string>();

  if (matchedNodeIds && matchedNodeIds.size > 0) {
    for (const id of allNodeIds) {
      if (!matchedNodeIds.has(id)) dim.add(id);
    }
  }

  if (connectedNodeIds && connectedNodeIds.size > 0) {
    for (const id of allNodeIds) {
      if (!connectedNodeIds.has(id)) dim.add(id);
    }
  }

  return dim.size ? dim : null;
}

