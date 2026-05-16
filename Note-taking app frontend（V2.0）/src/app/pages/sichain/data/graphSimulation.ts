import { type GraphNode, type GraphEdge } from './graphBuilder';

export function runSimulation(nodes: GraphNode[], edges: GraphEdge[], W: number, H: number, steps = 200) {
  const REPULSION = 4500;
  const SPRING_STRENGTH = 0.06;
  const SPRING_LENGTH = 110;
  const DAMPING = 0.82;
  const CENTER_F = 0.04;
  const cx = W / 2, cy = H / 2;

  for (let step = 0; step < steps; step++) {
    nodes.forEach(n => { n.fx = 0; n.fy = 0; });

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x || 0.1;
        const dy = nodes[j].y - nodes[i].y || 0.1;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = REPULSION / (dist * dist);
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        nodes[i].fx -= fx; nodes[i].fy -= fy;
        nodes[j].fx += fx; nodes[j].fy += fy;
      }
    }

    // Springs
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
      const fx = (dx / dist) * f, fy = (dy / dist) * f;
      a.fx += fx; a.fy += fy; b.fx -= fx; b.fy -= fy;
    });

    // Center gravity
    nodes.forEach(n => {
      n.fx += (cx - n.x) * CENTER_F;
      n.fy += (cy - n.y) * CENTER_F;
    });

    // Update
    nodes.forEach(n => {
      n.vx = (n.vx + n.fx) * DAMPING;
      n.vy = (n.vy + n.fy) * DAMPING;
      n.x = Math.max(n.r + 5, Math.min(W - n.r - 5, n.x + n.vx));
      n.y = Math.max(n.r + 5, Math.min(H - n.r - 5, n.y + n.vy));
    });
  }
}
