/**
 * Unit Tests for Graph Traversal Service
 */

const graphTraversal = require('./graph_traversal');
const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');

// Mock dependencies
jest.mock('../entity/entity_store');
jest.mock('../relation/relation_store');

describe('Graph Traversal Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    entityStore.getEntity = jest.fn();
    relationStore.getRelations = jest.fn();
  });

  describe('traverseBFS', () => {
    it('should traverse graph using BFS', async () => {
      const mockStartEntity = {
        id: 'e1',
        canonical_name: 'Entity 1'
      };

      const mockRelations = [
        {
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.8,
          weight: 1.0
        }
      ];

      const mockTargetEntity = {
        id: 'e2',
        canonical_name: 'Entity 2'
      };

      entityStore.getEntity = jest.fn()
        .mockResolvedValueOnce(mockStartEntity)
        .mockResolvedValueOnce(mockTargetEntity);
      
      relationStore.getRelations = jest.fn()
        .mockResolvedValueOnce(mockRelations)
        .mockResolvedValueOnce([]);

      const result = await graphTraversal.traverseBFS('e1', {
        maxDepth: 2,
        minConfidence: 0.5
      });

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.depth_map['e1']).toBe(0);
      expect(result.depth_map['e2']).toBe(1);
    });

    it('should respect maxDepth limit', async () => {
      const mockStartEntity = { id: 'e1', canonical_name: 'Entity 1' };

      entityStore.getEntity = jest.fn().mockResolvedValue(mockStartEntity);
      relationStore.getRelations = jest.fn().mockResolvedValue([]);

      const result = await graphTraversal.traverseBFS('e1', {
        maxDepth: 0
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
    });

    it('should filter by relation types', async () => {
      const mockStartEntity = { id: 'e1', canonical_name: 'Entity 1' };

      const mockRelations = [
        {
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.8
        },
        {
          source_id: 'e1',
          target_id: 'e3',
          type: 'semantic',
          confidence: 0.8
        }
      ];

      entityStore.getEntity = jest.fn()
        .mockResolvedValueOnce(mockStartEntity)
        .mockResolvedValueOnce({ id: 'e2', canonical_name: 'Entity 2' });
      
      relationStore.getRelations = jest.fn()
        .mockResolvedValueOnce(mockRelations)
        .mockResolvedValueOnce([]);

      const result = await graphTraversal.traverseBFS('e1', {
        relationTypes: ['builtin']
      });

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].type).toBe('builtin');
    });

    it('should respect maxNodes limit', async () => {
      const mockStartEntity = { id: 'e1', canonical_name: 'Entity 1' };

      entityStore.getEntity = jest.fn().mockResolvedValue(mockStartEntity);
      relationStore.getRelations = jest.fn().mockResolvedValue([]);

      const result = await graphTraversal.traverseBFS('e1', {
        maxNodes: 1
      });

      expect(result.nodes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('traverseDFS', () => {
    it('should traverse graph using DFS', async () => {
      const mockStartEntity = { id: 'e1', canonical_name: 'Entity 1' };
      const mockEntity2 = { id: 'e2', canonical_name: 'Entity 2' };

      const mockRelations = [
        {
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.8,
          weight: 1.0
        }
      ];

      entityStore.getEntity = jest.fn()
        .mockResolvedValueOnce(mockStartEntity)
        .mockResolvedValueOnce(mockEntity2);
      
      relationStore.getRelations = jest.fn()
        .mockResolvedValueOnce(mockRelations)
        .mockResolvedValueOnce([]);

      const result = await graphTraversal.traverseDFS('e1', {
        maxDepth: 2
      });

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });
  });

  describe('findShortestPath', () => {
    it('should find shortest path between two entities', async () => {
      const mockRelations = [
        {
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.8
        },
        {
          source_id: 'e2',
          target_id: 'e3',
          type: 'builtin',
          confidence: 0.8
        }
      ];

      relationStore.getRelations = jest.fn()
        .mockResolvedValueOnce([mockRelations[0]])
        .mockResolvedValueOnce([mockRelations[1]]);

      const result = await graphTraversal.findShortestPath('e1', 'e3', {
        maxDepth: 5
      });

      expect(result.found).toBe(true);
      expect(result.path).toEqual(['e1', 'e2', 'e3']);
      expect(result.length).toBe(2);
    });

    it('should return not found if no path exists', async () => {
      relationStore.getRelations = jest.fn().mockResolvedValue([]);

      const result = await graphTraversal.findShortestPath('e1', 'e99', {
        maxDepth: 3
      });

      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.length).toBe(-1);
    });
  });

  describe('getNeighbors', () => {
    it('should get outgoing neighbors', async () => {
      const mockRelations = [
        {
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.8,
          weight: 1.0
        }
      ];

      const mockEntity = { id: 'e2', canonical_name: 'Entity 2' };

      relationStore.getRelations = jest.fn().mockResolvedValue(mockRelations);
      entityStore.getEntity = jest.fn().mockResolvedValue(mockEntity);

      const result = await graphTraversal.getNeighbors('e1', {
        direction: 'outgoing'
      });

      expect(result.entity_id).toBe('e1');
      expect(result.outgoing).toHaveLength(1);
      expect(result.incoming).toHaveLength(0);
    });

    it('should get incoming neighbors', async () => {
      const mockRelations = [
        {
          source_id: 'e2',
          target_id: 'e1',
          type: 'builtin',
          confidence: 0.8,
          weight: 1.0
        }
      ];

      const mockEntity = { id: 'e2', canonical_name: 'Entity 2' };

      relationStore.getRelations = jest.fn().mockResolvedValue(mockRelations);
      entityStore.getEntity = jest.fn().mockResolvedValue(mockEntity);

      const result = await graphTraversal.getNeighbors('e1', {
        direction: 'incoming'
      });

      expect(result.incoming).toHaveLength(1);
      expect(result.outgoing).toHaveLength(0);
    });

    it('should get both incoming and outgoing neighbors', async () => {
      const mockOutgoing = [
        {
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.8,
          weight: 1.0
        }
      ];

      const mockIncoming = [
        {
          source_id: 'e3',
          target_id: 'e1',
          type: 'builtin',
          confidence: 0.8,
          weight: 1.0
        }
      ];

      relationStore.getRelations = jest.fn()
        .mockResolvedValueOnce(mockOutgoing)
        .mockResolvedValueOnce(mockIncoming);
      
      entityStore.getEntity = jest.fn()
        .mockResolvedValueOnce({ id: 'e2', canonical_name: 'Entity 2' })
        .mockResolvedValueOnce({ id: 'e3', canonical_name: 'Entity 3' });

      const result = await graphTraversal.getNeighbors('e1', {
        direction: 'both'
      });

      expect(result.outgoing).toHaveLength(1);
      expect(result.incoming).toHaveLength(1);
    });
  });

  describe('getSubgraph', () => {
    it('should get subgraph around entity', async () => {
      const mockStartEntity = { id: 'e1', canonical_name: 'Entity 1' };
      const mockEntity2 = { id: 'e2', canonical_name: 'Entity 2' };

      const mockRelations = [
        {
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.8,
          weight: 1.0
        }
      ];

      entityStore.getEntity = jest.fn()
        .mockResolvedValueOnce(mockStartEntity)
        .mockResolvedValueOnce(mockEntity2);
      
      relationStore.getRelations = jest.fn()
        .mockResolvedValueOnce(mockRelations)
        .mockResolvedValueOnce([]);

      const result = await graphTraversal.getSubgraph('e1', {
        radius: 1,
        maxNodes: 10
      });

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.nodes[0].id).toBe('e1');
    });
  });
});
