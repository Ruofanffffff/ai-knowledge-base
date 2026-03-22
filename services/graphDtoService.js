function toRelationV1(relation) {
  const sourceTag = relation?.source_tag ?? relation?.sourceTag ?? relation?.source ?? relation?.linkSource ?? null;
  return {
    id: relation.id,
    source: relation.source,
    target: relation.target,
    name: relation.name,
    description: relation.description,
    layer: relation.layer ?? null,
    source_tag: sourceTag,
    linkSource: sourceTag,
  };
}

function toEntityV1(entity) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    entityType: entity.entityType ?? null,
    source: entity.source ?? null,
  };
}

function toPrincipleV1(principle) {
  return {
    id: principle.id,
    name: principle.name,
    description: principle.description,
    relatedEntityIds: principle.relatedEntityIds ?? undefined,
    source: principle.source ?? null,
  };
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function buildGraphDtoV1({ scope, docId, noteId, entities = [], relations = [], principles = [] }) {
  const base = {
    scope,
    ...(docId ? { docId } : {}),
    ...(noteId ? { noteId } : {}),
    entities: entities.map(toEntityV1),
    relations: relations.map(toRelationV1),
    principles: principles.map(toPrincipleV1),
  };
  return stripUndefined(base);
}

function fromUnifiedPrisma({ entities = [], relations = [], principles = [] }) {
  return buildGraphDtoV1({
    scope: 'unified',
    entities: entities.map((e) => ({
      id: e.id,
      name: e.cleanedName,
      description: e.description,
      entityType: e.entityType,
      source: e.source,
    })),
    relations: relations.map((r) => ({
      id: r.id,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      name: r.cleanedName,
      description: r.description,
      layer: r.layer,
      source_tag: r.source,
    })),
    principles: principles.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      source: p.source,
    })),
  });
}

function fromDocPrisma({ docId, entities = [], relations = [], principles = [] }) {
  return buildGraphDtoV1({
    scope: 'doc',
    docId,
    entities: entities.map((e) => ({
      id: e.id,
      name: e.cleanedName,
      description: e.description,
      entityType: e.entityType,
      source: e.source,
    })),
    relations: relations.map((r) => ({
      id: r.id,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      name: r.cleanedName,
      description: r.description,
      layer: r.layer,
      source_tag: r.source,
    })),
    principles: principles.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      relatedEntityIds: p.relatedEntityIds,
      source: p.source,
    })),
  });
}

function fromNoteGraph({ noteId, entities = [], relations = [], defaultEntityType = 'concept', defaultSource = 'inferred' }) {
  return buildGraphDtoV1({
    scope: 'note',
    noteId,
    entities: entities.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      entityType: e.entityType ?? defaultEntityType,
      source: e.source ?? defaultSource,
    })),
    relations: relations.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      name: r.name,
      description: r.description,
      layer: r.layer ?? 'how',
      source_tag: r.source_tag ?? r.linkSource ?? defaultSource,
    })),
    principles: [],
  });
}

function fromNotesAggregate({ entities = [], relations = [] }) {
  return buildGraphDtoV1({
    scope: 'notes',
    entities: entities.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      entityType: e.entityType ?? 'concept',
      source: e.source ?? 'inferred',
    })),
    relations: relations.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      name: r.name,
      description: r.description,
      layer: r.layer ?? 'how',
      source_tag: r.source_tag ?? r.linkSource ?? 'inferred',
    })),
    principles: [],
  });
}

module.exports = {
  buildGraphDtoV1,
  fromUnifiedPrisma,
  fromDocPrisma,
  fromNoteGraph,
  fromNotesAggregate,
};
