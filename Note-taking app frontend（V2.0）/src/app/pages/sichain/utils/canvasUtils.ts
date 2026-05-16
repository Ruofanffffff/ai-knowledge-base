// ── Color constants ──────────────────────────────────────────────────
export const NODE_COLORS = [
  '#6366F1', '#8B5CF6', '#3B82F6', '#06B6D4',
  '#10B981', '#F59E0B', '#EC4899', '#14B8A6',
];

export function getColor(idx: number) { return NODE_COLORS[idx % NODE_COLORS.length]; }

// ── Canvas round-rect helper ──
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Mini-network layout (200×140 viewBox) — used by graph-gen overlay animations ──
export const GG_NODES = [
  { cx:100, cy:70,  r:22, color:'#6366F1', isCenter:true },
  { cx:100, cy:14,  r:12, color:'#8B5CF6' },
  { cx:155, cy:42,  r:11, color:'#3B82F6' },
  { cx:155, cy:98,  r:13, color:'#10B981' },
  { cx:100, cy:126, r:11, color:'#F59E0B' },
  { cx:45,  cy:98,  r:12, color:'#EC4899' },
  { cx:45,  cy:42,  r:11, color:'#14B8A6' },
];
export const GG_EDGES = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,2],[3,4],[5,6]];
