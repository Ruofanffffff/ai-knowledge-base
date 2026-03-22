export type GraphScopeV1 = 'unified' | 'doc' | 'note' | 'notes';
export type GraphLayerV1 = 'how' | 'why';
export type SourceTagV1 = 'fact' | 'inferred' | 'pattern';
export type EntityTypeV1 =
  | 'concept'
  | 'object'
  | 'process'
  | 'role'
  | 'rule'
  | 'tool'
  | 'target'
  | 'data'
  | 'technology'
  | 'person'
  | 'action'
  | 'domain'
  | 'default';

export interface GraphEntityDTOv1 {
  id: string;
  name: string;
  description: string;
  entityType?: EntityTypeV1 | string | null;
  source?: SourceTagV1 | string | null;
}

export interface GraphRelationDTOv1 {
  id: string;
  source: string;
  target: string;
  name: string;
  description: string;
  layer?: GraphLayerV1 | string | null;
  source_tag?: SourceTagV1 | string | null;
  linkSource?: SourceTagV1 | string | null;
  sourceTag?: SourceTagV1 | string | null;
}

export interface GraphPrincipleDTOv1 {
  id: string;
  name: string;
  description: string;
  relatedEntityIds?: string[] | string | undefined;
  source?: SourceTagV1 | string | null;
}

export interface GraphDTOv1 {
  scope: GraphScopeV1 | string;
  docId?: string;
  noteId?: string;
  entities: GraphEntityDTOv1[];
  relations: GraphRelationDTOv1[];
  principles: GraphPrincipleDTOv1[];
}

export interface GraphEntityDTOv1Normalized {
  id: string;
  name: string;
  description: string;
  entityType: EntityTypeV1;
  source: SourceTagV1;
}

export interface GraphRelationDTOv1Normalized {
  id: string;
  source: string;
  target: string;
  name: string;
  description: string;
  layer: GraphLayerV1;
  source_tag: SourceTagV1;
  linkSource: SourceTagV1;
}

export interface GraphPrincipleDTOv1Normalized {
  id: string;
  name: string;
  description: string;
  relatedEntityIds?: string[];
  source: SourceTagV1;
}

export interface GraphDTOv1Normalized {
  scope: GraphScopeV1;
  docId?: string;
  noteId?: string;
  entities: GraphEntityDTOv1Normalized[];
  relations: GraphRelationDTOv1Normalized[];
  principles: GraphPrincipleDTOv1Normalized[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

export function coerceScopeV1(value: unknown): GraphScopeV1 {
  const v = String(value ?? '').toLowerCase();
  if (v === 'unified') return 'unified';
  if (v === 'doc' || v === 'document' || v === 'documents') return 'doc';
  if (v === 'note' || v === 'notes') return v === 'notes' ? 'notes' : 'note';
  return 'unified';
}

export function coerceLayerV1(value: unknown): GraphLayerV1 {
  const v = String(value ?? '').toLowerCase();
  if (v === 'why') return 'why';
  return 'how';
}

export function coerceSourceTagV1(value: unknown): SourceTagV1 {
  const v = String(value ?? '').toLowerCase();
  if (v === 'fact') return 'fact';
  if (v === 'inferred') return 'inferred';
  if (v === 'pattern') return 'pattern';
  return 'fact';
}

export function coerceEntityTypeV1(value: unknown): EntityTypeV1 {
  const v = String(value ?? '').toLowerCase();
  if (
    v === 'concept' ||
    v === 'object' ||
    v === 'process' ||
    v === 'role' ||
    v === 'rule' ||
    v === 'tool' ||
    v === 'target' ||
    v === 'data' ||
    v === 'technology' ||
    v === 'person' ||
    v === 'action' ||
    v === 'domain' ||
    v === 'default'
  ) {
    return v;
  }
  return 'concept';
}

export function normalizeGraphEntityDTOv1(
  entity: unknown,
  defaults?: Partial<Pick<GraphEntityDTOv1Normalized, 'entityType' | 'source'>>
): GraphEntityDTOv1Normalized {
  const dEntityType = defaults?.entityType ?? 'concept';
  const dSource = defaults?.source ?? 'fact';

  if (!isRecord(entity)) {
    return { id: '', name: '', description: '', entityType: dEntityType, source: dSource };
  }

  const id = asString(entity.id);
  const name = asString(entity.name);
  const description = asString(entity.description);
  const entityType = coerceEntityTypeV1(entity.entityType ?? dEntityType);
  const source = coerceSourceTagV1(entity.source ?? dSource);
  return { id, name, description, entityType, source };
}

export function normalizeGraphRelationDTOv1(
  relation: unknown,
  defaults?: Partial<Pick<GraphRelationDTOv1Normalized, 'layer' | 'source_tag'>>
): GraphRelationDTOv1Normalized {
  const dLayer = defaults?.layer ?? 'how';
  const dSourceTag = defaults?.source_tag ?? 'fact';

  if (!isRecord(relation)) {
    return {
      id: '',
      source: '',
      target: '',
      name: '',
      description: '',
      layer: dLayer,
      source_tag: dSourceTag,
      linkSource: dSourceTag,
    };
  }

  const id = asString(relation.id);
  const source = asString(relation.source);
  const target = asString(relation.target);
  const name = asString(relation.name);
  const description = asString(relation.description);
  const layer = coerceLayerV1(relation.layer ?? dLayer);
  const source_tag = coerceSourceTagV1(
    relation.source_tag ?? relation.sourceTag ?? relation.source ?? relation.linkSource ?? dSourceTag
  );

  return { id, source, target, name, description, layer, source_tag, linkSource: source_tag };
}

export function normalizeGraphPrincipleDTOv1(
  principle: unknown,
  defaults?: Partial<Pick<GraphPrincipleDTOv1Normalized, 'source'>>
): GraphPrincipleDTOv1Normalized {
  const dSource = defaults?.source ?? 'fact';

  if (!isRecord(principle)) {
    return { id: '', name: '', description: '', source: dSource };
  }

  const id = asString(principle.id);
  const name = asString(principle.name);
  const description = asString(principle.description);
  const relatedEntityIdsRaw = principle.relatedEntityIds;
  const relatedEntityIds = Array.isArray(relatedEntityIdsRaw)
    ? relatedEntityIdsRaw.map(asString).filter(Boolean)
    : typeof relatedEntityIdsRaw === 'string'
      ? safeParseStringArray(relatedEntityIdsRaw)
      : undefined;

  const source = coerceSourceTagV1(principle.source ?? dSource);

  return relatedEntityIds?.length
    ? { id, name, description, relatedEntityIds, source }
    : { id, name, description, source };
}

function safeParseStringArray(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return undefined;
    const out = parsed.map(asString).filter(Boolean);
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeGraphDTOv1(
  input: unknown,
  defaults?: {
    scope?: GraphScopeV1;
    entityType?: EntityTypeV1;
    source?: SourceTagV1;
    layer?: GraphLayerV1;
    source_tag?: SourceTagV1;
  }
): GraphDTOv1Normalized {
  const dScope = defaults?.scope ?? 'unified';
  const dEntityType = defaults?.entityType ?? 'concept';
  const dSource = defaults?.source ?? 'fact';
  const dLayer = defaults?.layer ?? 'how';
  const dSourceTag = defaults?.source_tag ?? dSource;

  if (!isRecord(input)) {
    return { scope: dScope, entities: [], relations: [], principles: [] };
  }

  const scope = coerceScopeV1(input.scope ?? dScope);
  const docId = asString(input.docId);
  const noteId = asString(input.noteId);

  const entitiesRaw = Array.isArray(input.entities) ? input.entities : [];
  const relationsRaw = Array.isArray(input.relations) ? input.relations : [];
  const principlesRaw = Array.isArray(input.principles) ? input.principles : [];

  const entities = entitiesRaw
    .map((e) => normalizeGraphEntityDTOv1(e, { entityType: dEntityType, source: dSource }))
    .filter((e) => e.id && e.name);

  const relations = relationsRaw
    .map((r) => normalizeGraphRelationDTOv1(r, { layer: dLayer, source_tag: dSourceTag }))
    .filter((r) => r.id && r.source && r.target);

  const principles = principlesRaw
    .map((p) => normalizeGraphPrincipleDTOv1(p, { source: dSource }))
    .filter((p) => p.id && p.name);

  return {
    scope,
    ...(docId ? { docId } : {}),
    ...(noteId ? { noteId } : {}),
    entities,
    relations,
    principles,
  };
}

