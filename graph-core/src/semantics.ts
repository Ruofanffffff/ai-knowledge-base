import type { EntityTypeV1, GraphLayerV1, SourceTagV1 } from './graphdto-v1';

export interface ColorSemantic {
  fill: string;
  stroke: string;
  bg: string;
  label: string;
}

export const ENTITY_TYPE_SEMANTICS: Record<EntityTypeV1, ColorSemantic> = {
  concept: { fill: '#8b5cf6', stroke: '#7c3aed', bg: 'rgba(139, 92, 246, 0.1)', label: '概念/理论' },
  object: { fill: '#6366f1', stroke: '#4f46e5', bg: 'rgba(99, 102, 241, 0.1)', label: '对象/产品' },
  process: { fill: '#10b981', stroke: '#059669', bg: 'rgba(16, 185, 129, 0.1)', label: '流程/方法' },
  role: { fill: '#f59e0b', stroke: '#d97706', bg: 'rgba(245, 158, 11, 0.1)', label: '人物/角色' },
  rule: { fill: '#ef4444', stroke: '#dc2626', bg: 'rgba(239, 68, 68, 0.1)', label: '规则/规范' },
  tool: { fill: '#3b82f6', stroke: '#2563eb', bg: 'rgba(59, 130, 246, 0.1)', label: '工具/技术' },
  target: { fill: '#f97316', stroke: '#ea580c', bg: 'rgba(249, 115, 22, 0.1)', label: '目标/成果' },
  data: { fill: '#14b8a6', stroke: '#0d9488', bg: 'rgba(20, 184, 166, 0.1)', label: '数据/资源' },
  technology: { fill: '#6366f1', stroke: '#4f46e5', bg: 'rgba(99, 102, 241, 0.12)', label: '技术/工具' },
  person: { fill: '#f59e0b', stroke: '#d97706', bg: 'rgba(245, 158, 11, 0.12)', label: '人物/组织' },
  action: { fill: '#10b981', stroke: '#059669', bg: 'rgba(16, 185, 129, 0.12)', label: '方法/行为' },
  domain: { fill: '#3b82f6', stroke: '#2563eb', bg: 'rgba(59, 130, 246, 0.12)', label: '领域/场景' },
  default: { fill: '#64748b', stroke: '#475569', bg: 'rgba(100, 116, 139, 0.1)', label: '其他' },
};

export const LAYER_SEMANTICS: Record<GraphLayerV1, { label: string; dash?: string }> = {
  how: { label: 'How（结构）' },
  why: { label: 'Why（因果）', dash: '6 3' },
};

export const SOURCE_TAG_SEMANTICS: Record<SourceTagV1, { label: string; color: string; bg: string }> = {
  fact: { label: '事实', color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  inferred: { label: '推断', color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
  pattern: { label: '模式', color: '#7c3aed', bg: 'rgba(139,92,246,0.1)' },
};

export function getEntityTypeSemantic(entityType: string | null | undefined): ColorSemantic {
  const k = String(entityType ?? '').toLowerCase() as EntityTypeV1;
  return ENTITY_TYPE_SEMANTICS[k] ?? ENTITY_TYPE_SEMANTICS.default;
}

export function getLayerSemantic(layer: string | null | undefined): { label: string; dash?: string } {
  const k = String(layer ?? '').toLowerCase() as GraphLayerV1;
  return LAYER_SEMANTICS[k] ?? LAYER_SEMANTICS.how;
}

export function getSourceTagSemantic(sourceTag: string | null | undefined): { label: string; color: string; bg: string } {
  const k = String(sourceTag ?? '').toLowerCase() as SourceTagV1;
  return SOURCE_TAG_SEMANTICS[k] ?? SOURCE_TAG_SEMANTICS.fact;
}

