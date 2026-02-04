import { describe, it, expect } from 'vitest';
import {
  transformEntityToNode,
  transformRelationToLink,
  transformGraphData,
  transformNodeToEntity,
  transformLinkToRelation,
} from './transformers';
import { BackendEntity, BackendRelation, BackendGraphData, GraphNode, GraphLink } from '../api/types';

describe('transformEntityToNode', () => {
  it('should transform backend entity to frontend node with all fields', () => {
    const entity: BackendEntity = {
      id: 'entity-1',
      canonical_name: '人工智能',
      type: 'ConceptEntity',
      confidence: 0.95,
      schemas: [
        { schema_name: 'Concept', confidence: 0.92 },
        { schema_name: 'Technology', confidence: 0.88 }
      ],
      attributes: { category: 'technology', domain: 'AI' },
    };

    const node = transformEntityToNode(entity);

    expect(node).toEqual({
      id: 'entity-1',
      label: '人工智能',
      type: 'ConceptEntity',
      confidence: 0.95,
      schemas: [
        { schema_name: 'Concept', confidence: 0.92 },
        { schema_name: 'Technology', confidence: 0.88 }
      ],
      attributes: { category: 'technology', domain: 'AI' },
    });
  });

  it('should handle entities without optional fields', () => {
    const entity: BackendEntity = {
      id: 'entity-2',
      canonical_name: 'Test Entity',
      type: 'TestEntity',
      confidence: 0.8,
      schemas: [],
    };

    const node = transformEntityToNode(entity);

    expect(node.id).toBe('entity-2');
    expect(node.label).toBe('Test Entity');
    expect(node.type).toBe('TestEntity');
    expect(node.confidence).toBe(0.8);
    expect(node.schemas).toEqual([]);
    expect(node.attributes).toBeUndefined();
  });

  it('should preserve empty schemas array', () => {
    const entity: BackendEntity = {
      id: 'entity-3',
      canonical_name: 'Empty Schemas',
      type: 'Entity',
      confidence: 0.5,
      schemas: [],
    };

    const node = transformEntityToNode(entity);

    expect(node.schemas).toEqual([]);
  });

  it('should handle Chinese characters in canonical_name', () => {
    const entity: BackendEntity = {
      id: 'entity-4',
      canonical_name: '机器学习算法',
      type: 'ConceptEntity',
      confidence: 0.9,
      schemas: [],
    };

    const node = transformEntityToNode(entity);

    expect(node.label).toBe('机器学习算法');
  });
});

describe('transformRelationToLink', () => {
  it('should transform backend relation to frontend link with all fields', () => {
    const relation: BackendRelation = {
      id: 'rel-1',
      source_id: 'entity-1',
      target_id: 'entity-2',
      type: 'builtin',
      subtype: 'contains',
      weight: 0.8,
      confidence: 0.9,
    };

    const link = transformRelationToLink(relation);

    expect(link).toEqual({
      id: 'rel-1',
      source: 'entity-1',
      target: 'entity-2',
      relation: 'builtin',
      subtype: 'contains',
      weight: 0.8,
      confidence: 0.9,
    });
  });

  it('should handle relations without optional fields', () => {
    const relation: BackendRelation = {
      id: 'rel-2',
      source_id: 'entity-3',
      target_id: 'entity-4',
      type: 'semantic',
      confidence: 0.75,
    };

    const link = transformRelationToLink(relation);

    expect(link.id).toBe('rel-2');
    expect(link.source).toBe('entity-3');
    expect(link.target).toBe('entity-4');
    expect(link.relation).toBe('semantic');
    expect(link.confidence).toBe(0.75);
    expect(link.subtype).toBeUndefined();
    expect(link.weight).toBeUndefined();
  });

  it('should preserve zero weight and confidence values', () => {
    const relation: BackendRelation = {
      id: 'rel-3',
      source_id: 'entity-5',
      target_id: 'entity-6',
      type: 'cooccurrence',
      weight: 0,
      confidence: 0,
    };

    const link = transformRelationToLink(relation);

    expect(link.weight).toBe(0);
    expect(link.confidence).toBe(0);
  });
});

describe('transformGraphData', () => {
  it('should transform complete graph data with multiple entities and relations', () => {
    const backendData: BackendGraphData = {
      entities: [
        {
          id: 'e1',
          canonical_name: 'Entity 1',
          type: 'Type1',
          confidence: 0.9,
          schemas: [{ schema_name: 'Schema1', confidence: 0.85 }],
          attributes: { key: 'value' },
        },
        {
          id: 'e2',
          canonical_name: 'Entity 2',
          type: 'Type2',
          confidence: 0.85,
          schemas: [],
        },
      ],
      relations: [
        {
          id: 'r1',
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          subtype: 'related',
          confidence: 0.88,
        },
      ],
    };

    const frontendData = transformGraphData(backendData);

    expect(frontendData.nodes).toHaveLength(2);
    expect(frontendData.links).toHaveLength(1);
    
    expect(frontendData.nodes[0]).toEqual({
      id: 'e1',
      label: 'Entity 1',
      type: 'Type1',
      confidence: 0.9,
      schemas: [{ schema_name: 'Schema1', confidence: 0.85 }],
      attributes: { key: 'value' },
    });
    
    expect(frontendData.nodes[1]).toEqual({
      id: 'e2',
      label: 'Entity 2',
      type: 'Type2',
      confidence: 0.85,
      schemas: [],
      attributes: undefined,
    });
    
    expect(frontendData.links[0]).toEqual({
      id: 'r1',
      source: 'e1',
      target: 'e2',
      relation: 'builtin',
      subtype: 'related',
      weight: undefined,
      confidence: 0.88,
    });
  });

  it('should handle empty graph data', () => {
    const backendData: BackendGraphData = {
      entities: [],
      relations: [],
    };

    const frontendData = transformGraphData(backendData);

    expect(frontendData.nodes).toEqual([]);
    expect(frontendData.links).toEqual([]);
  });

  it('should handle graph with entities but no relations', () => {
    const backendData: BackendGraphData = {
      entities: [
        {
          id: 'e1',
          canonical_name: 'Isolated Entity',
          type: 'Entity',
          confidence: 0.7,
          schemas: [],
        },
      ],
      relations: [],
    };

    const frontendData = transformGraphData(backendData);

    expect(frontendData.nodes).toHaveLength(1);
    expect(frontendData.links).toHaveLength(0);
  });

  it('should handle large graph data', () => {
    const entities: BackendEntity[] = Array.from({ length: 100 }, (_, i) => ({
      id: `entity-${i}`,
      canonical_name: `Entity ${i}`,
      type: 'TestEntity',
      confidence: 0.8,
      schemas: [],
    }));

    const relations: BackendRelation[] = Array.from({ length: 50 }, (_, i) => ({
      id: `rel-${i}`,
      source_id: `entity-${i}`,
      target_id: `entity-${i + 1}`,
      type: 'builtin',
      confidence: 0.75,
    }));

    const backendData: BackendGraphData = { entities, relations };
    const frontendData = transformGraphData(backendData);

    expect(frontendData.nodes).toHaveLength(100);
    expect(frontendData.links).toHaveLength(50);
  });
});

describe('transformNodeToEntity', () => {
  it('should transform frontend node to backend entity with all fields', () => {
    const node: GraphNode = {
      id: 'node-1',
      label: 'Test Node',
      type: 'NodeType',
      confidence: 0.92,
      schemas: [{ schema_name: 'TestSchema', confidence: 0.9 }],
      attributes: { prop: 'value' },
    };

    const entity = transformNodeToEntity(node);

    expect(entity).toEqual({
      id: 'node-1',
      canonical_name: 'Test Node',
      type: 'NodeType',
      confidence: 0.92,
      schemas: [{ schema_name: 'TestSchema', confidence: 0.9 }],
      attributes: { prop: 'value' },
    });
  });

  it('should handle nodes without optional fields', () => {
    const node: GraphNode = {
      id: 'node-2',
      label: 'Simple Node',
      type: 'SimpleType',
      confidence: 0.6,
    };

    const entity = transformNodeToEntity(node);

    expect(entity.id).toBe('node-2');
    expect(entity.canonical_name).toBe('Simple Node');
    expect(entity.type).toBe('SimpleType');
    expect(entity.confidence).toBe(0.6);
    expect(entity.schemas).toBeUndefined();
    expect(entity.attributes).toBeUndefined();
  });

  it('should preserve empty schemas array', () => {
    const node: GraphNode = {
      id: 'node-3',
      label: 'Node with Empty Schemas',
      type: 'Type',
      confidence: 0.5,
      schemas: [],
    };

    const entity = transformNodeToEntity(node);

    expect(entity.schemas).toEqual([]);
  });
});

describe('transformLinkToRelation', () => {
  it('should transform frontend link to backend relation with all fields', () => {
    const link: GraphLink = {
      id: 'link-1',
      source: 'node-1',
      target: 'node-2',
      relation: 'semantic',
      subtype: 'similar',
      weight: 0.85,
      confidence: 0.9,
    };

    const relation = transformLinkToRelation(link);

    expect(relation).toEqual({
      id: 'link-1',
      source_id: 'node-1',
      target_id: 'node-2',
      type: 'semantic',
      subtype: 'similar',
      weight: 0.85,
      confidence: 0.9,
    });
  });

  it('should handle links without optional fields', () => {
    const link: GraphLink = {
      id: 'link-2',
      source: 'node-3',
      target: 'node-4',
      relation: 'builtin',
      confidence: 0.7,
    };

    const relation = transformLinkToRelation(link);

    expect(relation.id).toBe('link-2');
    expect(relation.source_id).toBe('node-3');
    expect(relation.target_id).toBe('node-4');
    expect(relation.type).toBe('builtin');
    expect(relation.confidence).toBe(0.7);
    expect(relation.subtype).toBeUndefined();
    expect(relation.weight).toBeUndefined();
  });
});

describe('round-trip transformations', () => {
  it('should preserve data when transforming entity -> node -> entity', () => {
    const originalEntity: BackendEntity = {
      id: 'entity-rt-1',
      canonical_name: 'Round Trip Entity',
      type: 'TestType',
      confidence: 0.88,
      schemas: [{ schema_name: 'Schema', confidence: 0.85 }],
      attributes: { test: 'value' },
    };

    const node = transformEntityToNode(originalEntity);
    const backToEntity = transformNodeToEntity(node);

    expect(backToEntity).toEqual({
      id: originalEntity.id,
      canonical_name: originalEntity.canonical_name,
      type: originalEntity.type,
      confidence: originalEntity.confidence,
      schemas: originalEntity.schemas,
      attributes: originalEntity.attributes,
    });
  });

  it('should preserve data when transforming relation -> link -> relation', () => {
    const originalRelation: BackendRelation = {
      id: 'rel-rt-1',
      source_id: 'entity-1',
      target_id: 'entity-2',
      type: 'semantic',
      subtype: 'related',
      weight: 0.75,
      confidence: 0.82,
    };

    const link = transformRelationToLink(originalRelation);
    const backToRelation = transformLinkToRelation(link);

    expect(backToRelation).toEqual({
      id: originalRelation.id,
      source_id: originalRelation.source_id,
      target_id: originalRelation.target_id,
      type: originalRelation.type,
      subtype: originalRelation.subtype,
      weight: originalRelation.weight,
      confidence: originalRelation.confidence,
    });
  });
});
