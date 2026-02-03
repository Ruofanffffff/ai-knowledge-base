/**
 * Property-Based Tests for Graph Traversal Service
 * 
 * Property 20: Graph Traversal Completeness
 * 
 * Validates: Requirements 9.1-9.10
 */

const fc = require('fast-check');
const graphTraversal = require('./graph_traversal');
const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');

// Mock dependencies
jest.mock('../entity/entity_store');
jest.mock('../relation/relation_store');

describe('Graph Traversal - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    entityStore.getEntity = jest.fn();
    relationStore.getRelations = jest.fn();
  });

  /**
   * Property 20: Graph Traversal Completeness
   * 
   * For any entity and depth N, traversing the graph should return all entities
   * reachable within N hops through any relation type (unless filtered).
   * 
   * Validates: Requirements 9.1, 9.2, 9.3, 9.4
   */
  describe('Property 20: Graph Traversal Completeness', () => {
    it('should return all reachable entities within maxDepth', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }), // maxDepth
          fc.integer({ min: 2, max: 10 }), // number of entities
          async (maxDepth, numEntities) => {
            // Generate a simple graph structure
            const entities = Array.from({ length: numEntities }, (_, i) => ({
              id: `e${i}`,
              canonical_name: `Entity ${i}`,
              confidence: 0.8
            }));

            // Create a chain: e0 -> e1 -> e2 -> ...
            const relations = [];
            for (let i = 0; i < numEntities - 1; i++) {
              relations.push({
                source_id: `e${i}`,
                target_id: `e${i + 1}`,
                type: 'builtin',
                confidence: 0.8,
                weight: 1.0
              });
            }

            // Mock entity store
            entityStore.getEntity = jest.fn((id) => {
              return Promise.resolve(entities.find(e => e.id === id));
            });

            // Mock relation store
            relationStore.getRelations = jest.fn(({ source_id }) => {
              return Promise.resolve(
                relations.filter(r => r.source_id === source_id)
              );
            });

            // Traverse from e0
            const result = await graphTraversal.traverseBFS('e0', {
              maxDepth,
              minConfidence: 0.5,
              maxNodes: 100
            });

            // Verify: should reach entities within maxDepth
            const expectedReachable = Math.min(maxDepth + 1, numEntities);
            expect(result.nodes.length).toBe(expectedReachable);

            // Verify: all nodes should be within maxDepth
            for (const [entityId, depth] of Object.entries(result.depth_map)) {
              expect(depth).toBeLessThanOrEqual(maxDepth);
            }

            // Verify: edges should connect consecutive entities
            expect(result.edges.length).toBe(expectedReachable - 1);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should respect relation type filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // number of entities
          fc.constantFrom('builtin', 'cooccurrence', 'semantic'), // filter type
          async (numEntities, filterType) => {
            // Generate entities
            const entities = Array.from({ length: numEntities }, (_, i) => ({
              id: `e${i}`,
              canonical_name: `Entity ${i}`,
              confidence: 0.8
            }));

            // Create relations with different types
            const relations = [];
            for (let i = 0; i < numEntities - 1; i++) {
              const relationType = i % 2 === 0 ? 'builtin' : 'semantic';
              relations.push({
                source_id: `e${i}`,
                target_id: `e${i + 1}`,
                type: relationType,
                confidence: 0.8,
                weight: 1.0
              });
            }

            // Mock stores
            entityStore.getEntity = jest.fn((id) => {
              return Promise.resolve(entities.find(e => e.id === id));
            });

            relationStore.getRelations = jest.fn(({ source_id }) => {
              return Promise.resolve(
                relations.filter(r => r.source_id === source_id)
              );
            });

            // Traverse with filter
            const result = await graphTraversal.traverseBFS('e0', {
              maxDepth: 3,
              relationTypes: [filterType],
              minConfidence: 0.5,
              maxNodes: 100
            });

            // Verify: all edges should match the filter type
            for (const edge of result.edges) {
              expect(edge.type).toBe(filterType);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should respect confidence threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: Math.fround(0.3), max: Math.fround(0.9) }), // minConfidence
          fc.integer({ min: 3, max: 8 }), // number of entities
          async (minConfidence, numEntities) => {
            // Filter out NaN and infinite values
            if (!isFinite(minConfidence)) {
              return true;
            }

            // Round to avoid floating point precision issues
            minConfidence = Math.fround(minConfidence);

            // Generate entities
            const entities = Array.from({ length: numEntities }, (_, i) => ({
              id: `e${i}`,
              canonical_name: `Entity ${i}`,
              confidence: 0.8
            }));

            // Create relations with varying confidence
            const relations = [];
            for (let i = 0; i < numEntities - 1; i++) {
              const confidence = Math.fround(0.4 + (i * 0.1));
              relations.push({
                source_id: `e${i}`,
                target_id: `e${i + 1}`,
                type: 'builtin',
                confidence: confidence,
                weight: 1.0
              });
            }

            // Mock stores
            entityStore.getEntity = jest.fn((id) => {
              return Promise.resolve(entities.find(e => e.id === id));
            });

            relationStore.getRelations = jest.fn(({ source_id, confidence: confFilter }) => {
              const sourceRelations = relations.filter(r => r.source_id === source_id);
              if (confFilter && confFilter.$gte !== undefined) {
                return Promise.resolve(
                  sourceRelations.filter(r => r.confidence >= confFilter.$gte)
                );
              }
              return Promise.resolve(sourceRelations);
            });

            // Traverse with confidence filter
            const result = await graphTraversal.traverseBFS('e0', {
              maxDepth: 5,
              minConfidence: minConfidence,
              maxNodes: 100
            });

            // Verify: all edges should have confidence >= minConfidence
            for (const edge of result.edges) {
              expect(edge.confidence).toBeGreaterThanOrEqual(minConfidence - 0.01); // Allow small floating point error
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should find shortest path correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 6 }), // path length
          async (pathLength) => {
            // Generate a chain of entities
            const entities = Array.from({ length: pathLength }, (_, i) => ({
              id: `e${i}`,
              canonical_name: `Entity ${i}`,
              confidence: 0.8
            }));

            // Create chain relations
            const relations = [];
            for (let i = 0; i < pathLength - 1; i++) {
              relations.push({
                source_id: `e${i}`,
                target_id: `e${i + 1}`,
                type: 'builtin',
                confidence: 0.8,
                weight: 1.0
              });
            }

            // Mock stores
            entityStore.getEntity = jest.fn((id) => {
              return Promise.resolve(entities.find(e => e.id === id));
            });

            relationStore.getRelations = jest.fn(({ source_id }) => {
              return Promise.resolve(
                relations.filter(r => r.source_id === source_id)
              );
            });

            // Find shortest path from e0 to last entity
            const targetId = `e${pathLength - 1}`;
            const result = await graphTraversal.findShortestPath('e0', targetId, {
              maxDepth: pathLength + 2,
              minConfidence: 0.5
            });

            // Verify: path should be found
            expect(result.found).toBe(true);

            // Verify: path length should equal number of hops
            expect(result.length).toBe(pathLength - 1);

            // Verify: path should start with e0 and end with target
            expect(result.path[0]).toBe('e0');
            expect(result.path[result.path.length - 1]).toBe(targetId);

            // Verify: path should be continuous
            for (let i = 0; i < result.path.length - 1; i++) {
              const expectedSource = `e${i}`;
              const expectedTarget = `e${i + 1}`;
              expect(result.path[i]).toBe(expectedSource);
              expect(result.path[i + 1]).toBe(expectedTarget);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle disconnected graphs correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // number of disconnected components
          async (numComponents) => {
            // Generate disconnected components
            const entities = [];
            const relations = [];

            for (let comp = 0; comp < numComponents; comp++) {
              // Each component has 2 entities
              const e1 = { id: `e${comp}_0`, canonical_name: `Entity ${comp}_0`, confidence: 0.8 };
              const e2 = { id: `e${comp}_1`, canonical_name: `Entity ${comp}_1`, confidence: 0.8 };
              entities.push(e1, e2);

              // Connect within component
              relations.push({
                source_id: e1.id,
                target_id: e2.id,
                type: 'builtin',
                confidence: 0.8,
                weight: 1.0
              });
            }

            // Mock stores
            entityStore.getEntity = jest.fn((id) => {
              return Promise.resolve(entities.find(e => e.id === id));
            });

            relationStore.getRelations = jest.fn(({ source_id }) => {
              return Promise.resolve(
                relations.filter(r => r.source_id === source_id)
              );
            });

            // Traverse from first component
            const result = await graphTraversal.traverseBFS('e0_0', {
              maxDepth: 5,
              minConfidence: 0.5,
              maxNodes: 100
            });

            // Verify: should only reach entities in the same component
            expect(result.nodes.length).toBe(2);
            expect(result.nodes.every(n => n.id.startsWith('e0_'))).toBe(true);

            // Verify: should not reach other components
            const otherComponentIds = entities
              .filter(e => !e.id.startsWith('e0_'))
              .map(e => e.id);
            
            for (const node of result.nodes) {
              expect(otherComponentIds).not.toContain(node.id);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should respect maxNodes limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // maxNodes
          fc.integer({ min: 5, max: 15 }), // total entities
          async (maxNodes, totalEntities) => {
            // Generate entities
            const entities = Array.from({ length: totalEntities }, (_, i) => ({
              id: `e${i}`,
              canonical_name: `Entity ${i}`,
              confidence: 0.8
            }));

            // Create chain relations
            const relations = [];
            for (let i = 0; i < totalEntities - 1; i++) {
              relations.push({
                source_id: `e${i}`,
                target_id: `e${i + 1}`,
                type: 'builtin',
                confidence: 0.8,
                weight: 1.0
              });
            }

            // Mock stores
            entityStore.getEntity = jest.fn((id) => {
              return Promise.resolve(entities.find(e => e.id === id));
            });

            relationStore.getRelations = jest.fn(({ source_id }) => {
              return Promise.resolve(
                relations.filter(r => r.source_id === source_id)
              );
            });

            // Traverse with maxNodes limit
            const result = await graphTraversal.traverseBFS('e0', {
              maxDepth: 10,
              minConfidence: 0.5,
              maxNodes: maxNodes
            });

            // Verify: should not exceed maxNodes
            expect(result.nodes.length).toBeLessThanOrEqual(maxNodes);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle cyclic graphs without infinite loops', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 6 }), // cycle length
          async (cycleLength) => {
            // Generate entities forming a cycle
            const entities = Array.from({ length: cycleLength }, (_, i) => ({
              id: `e${i}`,
              canonical_name: `Entity ${i}`,
              confidence: 0.8
            }));

            // Create cycle: e0 -> e1 -> e2 -> ... -> e0
            const relations = [];
            for (let i = 0; i < cycleLength; i++) {
              const targetId = `e${(i + 1) % cycleLength}`;
              relations.push({
                source_id: `e${i}`,
                target_id: targetId,
                type: 'builtin',
                confidence: 0.8,
                weight: 1.0
              });
            }

            // Mock stores
            entityStore.getEntity = jest.fn((id) => {
              return Promise.resolve(entities.find(e => e.id === id));
            });

            relationStore.getRelations = jest.fn(({ source_id }) => {
              return Promise.resolve(
                relations.filter(r => r.source_id === source_id)
              );
            });

            // Traverse the cycle
            const result = await graphTraversal.traverseBFS('e0', {
              maxDepth: cycleLength + 2,
              minConfidence: 0.5,
              maxNodes: 100
            });

            // Verify: should visit each node exactly once (no duplicates)
            const nodeIds = result.nodes.map(n => n.id);
            const uniqueNodeIds = [...new Set(nodeIds)];
            expect(nodeIds.length).toBe(uniqueNodeIds.length);

            // Verify: should visit all nodes in the cycle
            expect(result.nodes.length).toBe(cycleLength);
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
