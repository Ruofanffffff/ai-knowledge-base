import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  transformEntityToNode,
  transformRelationToLink,
  transformGraphData,
  transformNodeToEntity,
  transformLinkToRelation,
} from './transformers';
import type {
  BackendGraphData,
} from '../api/types';

/**
 * Property-Based Test: Data Transformation Correctness
 * 
 * **Validates: Requirements AC-4.2**
 * 
 * This test verifies that data transformations between backend and frontend
 * formats preserve all essential fields and maintain data integrity.
 * 
 * Properties tested:
 * 1. Entity to Node transformation preserves all required fields
 * 2. Relation to Link transformation preserves all required fields
 * 3. Round-trip transformations maintain data integrity
 * 4. Batch transformations maintain array length and order
 * 5. Optional fields are handled correctly
 */

// Arbitrary for BackendEntity
const backendEntityArbitrary = fc.record({
  id: fc.uuid(),
  canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
  type: fc.constantFrom('ConceptEntity', 'PersonEntity', 'LocationEntity', 'OrganizationEntity'),
  confidence: fc.double({ min: 0, max: 1 }),
  schemas: fc.array(
    fc.record({
      schema_name: fc.string({ minLength: 1, maxLength: 50 }),
      confidence: fc.double({ min: 0, max: 1 }),
    }),
    { maxLength: 5 }
  ),
  attributes: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
});

// Arbitrary for BackendRelation
const backendRelationArbitrary = fc.record({
  id: fc.uuid(),
  source_id: fc.uuid(),
  target_id: fc.uuid(),
  type: fc.constantFrom('builtin', 'semantic', 'cooccurrence'),
  subtype: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  weight: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
  confidence: fc.double({ min: 0, max: 1 }),
});

describe('Property-Based Test: Data Transformation Correctness', () => {
  describe('Entity to Node Transformation', () => {
    it('should preserve all required fields when transforming entity to node', () => {
      fc.assert(
        fc.property(backendEntityArbitrary, (entity) => {
          const node = transformEntityToNode(entity);

          // Verify all required fields are preserved
          expect(node.id).toBe(entity.id);
          expect(node.label).toBe(entity.canonical_name);
          expect(node.type).toBe(entity.type);
          expect(node.confidence).toBe(entity.confidence);
          expect(node.schemas).toEqual(entity.schemas);
          
          // Verify optional fields
          if (entity.attributes) {
            expect(node.attributes).toEqual(entity.attributes);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle entities with empty schemas array', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
            type: fc.constantFrom('ConceptEntity', 'PersonEntity', 'LocationEntity', 'OrganizationEntity'),
            confidence: fc.double({ min: 0, max: 1 }),
            schemas: fc.constant([]),
            attributes: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
          }),
          (entity) => {
            const node = transformEntityToNode(entity);
            expect(node.schemas).toEqual([]);
            expect(Array.isArray(node.schemas)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle entities without attributes', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
            type: fc.constantFrom('ConceptEntity', 'PersonEntity', 'LocationEntity', 'OrganizationEntity'),
            confidence: fc.double({ min: 0, max: 1 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.double({ min: 0, max: 1 }),
              }),
              { maxLength: 5 }
            ),
            attributes: fc.constant(undefined),
          }),
          (entity) => {
            const node = transformEntityToNode(entity);
            expect(node.attributes).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Relation to Link Transformation', () => {
    it('should preserve all required fields when transforming relation to link', () => {
      fc.assert(
        fc.property(backendRelationArbitrary, (relation) => {
          const link = transformRelationToLink(relation);

          // Verify all required fields are preserved
          expect(link.id).toBe(relation.id);
          expect(link.source).toBe(relation.source_id);
          expect(link.target).toBe(relation.target_id);
          expect(link.relation).toBe(relation.type);
          expect(link.confidence).toBe(relation.confidence);
          
          // Verify optional fields
          if (relation.subtype !== undefined) {
            expect(link.subtype).toBe(relation.subtype);
          }
          if (relation.weight !== undefined) {
            expect(link.weight).toBe(relation.weight);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle relations without optional fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            source_id: fc.uuid(),
            target_id: fc.uuid(),
            type: fc.constantFrom('builtin', 'semantic', 'cooccurrence'),
            subtype: fc.constant(undefined),
            weight: fc.constant(undefined),
            confidence: fc.double({ min: 0, max: 1 }),
          }),
          (relation) => {
            const link = transformRelationToLink(relation);
            expect(link.subtype).toBeUndefined();
            expect(link.weight).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Graph Data Batch Transformation', () => {
    it('should preserve array length and order when transforming graph data', () => {
      fc.assert(
        fc.property(
          fc.record({
            entities: fc.array(backendEntityArbitrary, { maxLength: 20 }),
            relations: fc.array(backendRelationArbitrary, { maxLength: 20 }),
          }),
          (graphData: BackendGraphData) => {
            const transformed = transformGraphData(graphData);

            // Verify array lengths are preserved
            expect(transformed.nodes).toHaveLength(graphData.entities.length);
            expect(transformed.links).toHaveLength(graphData.relations.length);

            // Verify order is preserved by checking IDs
            graphData.entities.forEach((entity, index) => {
              expect(transformed.nodes[index].id).toBe(entity.id);
            });

            graphData.relations.forEach((relation, index) => {
              expect(transformed.links[index].id).toBe(relation.id);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty graph data', () => {
      fc.assert(
        fc.property(fc.constant({ entities: [], relations: [] }), (graphData) => {
          const transformed = transformGraphData(graphData);
          expect(transformed.nodes).toEqual([]);
          expect(transformed.links).toEqual([]);
        }),
        { numRuns: 10 }
      );
    });

    it('should handle graph data with only entities', () => {
      fc.assert(
        fc.property(
          fc.record({
            entities: fc.array(backendEntityArbitrary, { minLength: 1, maxLength: 10 }),
            relations: fc.constant([]),
          }),
          (graphData: BackendGraphData) => {
            const transformed = transformGraphData(graphData);
            expect(transformed.nodes.length).toBeGreaterThan(0);
            expect(transformed.links).toEqual([]);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle graph data with only relations', () => {
      fc.assert(
        fc.property(
          fc.record({
            entities: fc.constant([]),
            relations: fc.array(backendRelationArbitrary, { minLength: 1, maxLength: 10 }),
          }),
          (graphData: BackendGraphData) => {
            const transformed = transformGraphData(graphData);
            expect(transformed.nodes).toEqual([]);
            expect(transformed.links.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Round-Trip Transformations', () => {
    it('should maintain data integrity in node -> entity -> node transformation', () => {
      fc.assert(
        fc.property(backendEntityArbitrary, (originalEntity) => {
          // Transform: Entity -> Node -> Entity
          const node = transformEntityToNode(originalEntity);
          const backToEntity = transformNodeToEntity(node);

          // Verify essential fields are preserved
          expect(backToEntity.id).toBe(originalEntity.id);
          expect(backToEntity.canonical_name).toBe(originalEntity.canonical_name);
          expect(backToEntity.type).toBe(originalEntity.type);
          expect(backToEntity.confidence).toBe(originalEntity.confidence);
          expect(backToEntity.schemas).toEqual(originalEntity.schemas);
          
          if (originalEntity.attributes) {
            expect(backToEntity.attributes).toEqual(originalEntity.attributes);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should maintain data integrity in link -> relation -> link transformation', () => {
      fc.assert(
        fc.property(backendRelationArbitrary, (originalRelation) => {
          // Transform: Relation -> Link -> Relation
          const link = transformRelationToLink(originalRelation);
          const backToRelation = transformLinkToRelation(link);

          // Verify essential fields are preserved
          expect(backToRelation.id).toBe(originalRelation.id);
          expect(backToRelation.source_id).toBe(originalRelation.source_id);
          expect(backToRelation.target_id).toBe(originalRelation.target_id);
          expect(backToRelation.type).toBe(originalRelation.type);
          expect(backToRelation.confidence).toBe(originalRelation.confidence);
          
          if (originalRelation.subtype !== undefined) {
            expect(backToRelation.subtype).toBe(originalRelation.subtype);
          }
          if (originalRelation.weight !== undefined) {
            expect(backToRelation.weight).toBe(originalRelation.weight);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Field Type Preservation', () => {
    it('should preserve confidence as number type', () => {
      fc.assert(
        fc.property(backendEntityArbitrary, (entity) => {
          const node = transformEntityToNode(entity);
          expect(typeof node.confidence).toBe('number');
          expect(node.confidence).toBeGreaterThanOrEqual(0);
          expect(node.confidence).toBeLessThanOrEqual(1);
        }),
        { numRuns: 50 }
      );
    });

    it('should preserve ID as string type', () => {
      fc.assert(
        fc.property(backendEntityArbitrary, (entity) => {
          const node = transformEntityToNode(entity);
          expect(typeof node.id).toBe('string');
          expect(node.id.length).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    });

    it('should preserve schemas as array type', () => {
      fc.assert(
        fc.property(backendEntityArbitrary, (entity) => {
          const node = transformEntityToNode(entity);
          expect(Array.isArray(node.schemas)).toBe(true);
          
          // Verify each schema has required fields
          node.schemas?.forEach((schema) => {
            expect(typeof schema.schema_name).toBe('string');
            expect(typeof schema.confidence).toBe('number');
          });
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle entities with maximum confidence', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
            type: fc.constantFrom('ConceptEntity', 'PersonEntity', 'LocationEntity', 'OrganizationEntity'),
            confidence: fc.constant(1.0),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.double({ min: 0, max: 1 }),
              }),
              { maxLength: 5 }
            ),
            attributes: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
          }),
          (entity) => {
            const node = transformEntityToNode(entity);
            expect(node.confidence).toBe(1.0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle entities with minimum confidence', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            canonical_name: fc.string({ minLength: 1, maxLength: 100 }),
            type: fc.constantFrom('ConceptEntity', 'PersonEntity', 'LocationEntity', 'OrganizationEntity'),
            confidence: fc.constant(0.0),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.double({ min: 0, max: 1 }),
              }),
              { maxLength: 5 }
            ),
            attributes: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
          }),
          (entity) => {
            const node = transformEntityToNode(entity);
            expect(node.confidence).toBe(0.0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle very long entity names', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            canonical_name: fc.string({ minLength: 100, maxLength: 500 }),
            type: fc.constantFrom('ConceptEntity', 'PersonEntity', 'LocationEntity', 'OrganizationEntity'),
            confidence: fc.double({ min: 0, max: 1 }),
            schemas: fc.array(
              fc.record({
                schema_name: fc.string({ minLength: 1, maxLength: 50 }),
                confidence: fc.double({ min: 0, max: 1 }),
              }),
              { maxLength: 5 }
            ),
            attributes: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
          }),
          (entity) => {
            const node = transformEntityToNode(entity);
            expect(node.label).toBe(entity.canonical_name);
            expect(node.label.length).toBeGreaterThanOrEqual(100);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
