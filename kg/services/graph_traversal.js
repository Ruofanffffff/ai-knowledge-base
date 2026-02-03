/**
 * Graph Traversal Service
 * 
 * Implements BFS and DFS algorithms for knowledge graph traversal.
 * Supports filtering by relation types and confidence thresholds.
 * 
 * Requirements: 9.1-9.10
 */

const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');

/**
 * Traverse graph using Breadth-First Search (BFS)
 * @param {string} startEntityId - Starting entity ID
 * @param {Object} options - Traversal options
 * @returns {Promise<Object>} Traversal result
 */
async function traverseBFS(startEntityId, options = {}) {
  const {
    maxDepth = 3,
    relationTypes = null, // null = all types
    minConfidence = 0.5,
    maxNodes = 100
  } = options;

  const visited = new Set();
  const result = {
    nodes: [],
    edges: [],
    paths: [],
    depth_map: {}
  };

  const queue = [{ entityId: startEntityId, depth: 0, path: [startEntityId] }];
  visited.add(startEntityId);

  // Add start node
  const startEntity = await entityStore.getEntity(startEntityId);
  if (!startEntity) {
    throw new Error(`Start entity ${startEntityId} not found`);
  }
  result.nodes.push(startEntity);
  result.depth_map[startEntityId] = 0;

  while (queue.length > 0 && result.nodes.length < maxNodes) {
    const { entityId, depth, path } = queue.shift();

    if (depth >= maxDepth) {
      continue;
    }

    // Get outgoing relations
    const relations = await relationStore.getRelations({
      source_id: entityId,
      confidence: { $gte: minConfidence }
    });

    for (const relation of relations) {
      // Filter by relation type if specified
      if (relationTypes && !relationTypes.includes(relation.type)) {
        continue;
      }

      const targetId = relation.target_id;

      // Add edge
      result.edges.push({
        source: entityId,
        target: targetId,
        type: relation.type,
        confidence: relation.confidence,
        weight: relation.weight
      });

      // Add target node if not visited
      if (!visited.has(targetId)) {
        visited.add(targetId);

        const targetEntity = await entityStore.getEntity(targetId);
        if (targetEntity) {
          result.nodes.push(targetEntity);
          result.depth_map[targetId] = depth + 1;

          const newPath = [...path, targetId];
          queue.push({
            entityId: targetId,
            depth: depth + 1,
            path: newPath
          });

          // Record path
          result.paths.push({
            path: newPath,
            depth: depth + 1
          });
        }

        if (result.nodes.length >= maxNodes) {
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Traverse graph using Depth-First Search (DFS)
 * @param {string} startEntityId - Starting entity ID
 * @param {Object} options - Traversal options
 * @returns {Promise<Object>} Traversal result
 */
async function traverseDFS(startEntityId, options = {}) {
  const {
    maxDepth = 3,
    relationTypes = null,
    minConfidence = 0.5,
    maxNodes = 100
  } = options;

  const visited = new Set();
  const result = {
    nodes: [],
    edges: [],
    paths: [],
    depth_map: {}
  };

  // Add start node
  const startEntity = await entityStore.getEntity(startEntityId);
  if (!startEntity) {
    throw new Error(`Start entity ${startEntityId} not found`);
  }
  result.nodes.push(startEntity);
  result.depth_map[startEntityId] = 0;
  visited.add(startEntityId);

  // Recursive DFS helper
  async function dfs(entityId, depth, path) {
    if (depth >= maxDepth || result.nodes.length >= maxNodes) {
      return;
    }

    // Get outgoing relations
    const relations = await relationStore.getRelations({
      source_id: entityId,
      confidence: { $gte: minConfidence }
    });

    for (const relation of relations) {
      // Filter by relation type if specified
      if (relationTypes && !relationTypes.includes(relation.type)) {
        continue;
      }

      const targetId = relation.target_id;

      // Add edge
      result.edges.push({
        source: entityId,
        target: targetId,
        type: relation.type,
        confidence: relation.confidence,
        weight: relation.weight
      });

      // Add target node if not visited
      if (!visited.has(targetId)) {
        visited.add(targetId);

        const targetEntity = await entityStore.getEntity(targetId);
        if (targetEntity) {
          result.nodes.push(targetEntity);
          result.depth_map[targetId] = depth + 1;

          const newPath = [...path, targetId];
          result.paths.push({
            path: newPath,
            depth: depth + 1
          });

          // Recurse
          await dfs(targetId, depth + 1, newPath);

          if (result.nodes.length >= maxNodes) {
            break;
          }
        }
      }
    }
  }

  await dfs(startEntityId, 0, [startEntityId]);

  return result;
}

/**
 * Find shortest path between two entities
 * @param {string} sourceId - Source entity ID
 * @param {string} targetId - Target entity ID
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Path result
 */
async function findShortestPath(sourceId, targetId, options = {}) {
  const {
    maxDepth = 5,
    relationTypes = null,
    minConfidence = 0.5
  } = options;

  const visited = new Set();
  const queue = [{ entityId: sourceId, path: [sourceId], edges: [] }];
  visited.add(sourceId);

  while (queue.length > 0) {
    const { entityId, path, edges } = queue.shift();

    if (entityId === targetId) {
      // Found target
      return {
        found: true,
        path,
        edges,
        length: path.length - 1
      };
    }

    if (path.length - 1 >= maxDepth) {
      continue;
    }

    // Get outgoing relations
    const relations = await relationStore.getRelations({
      source_id: entityId,
      confidence: { $gte: minConfidence }
    });

    for (const relation of relations) {
      if (relationTypes && !relationTypes.includes(relation.type)) {
        continue;
      }

      const nextId = relation.target_id;

      if (!visited.has(nextId)) {
        visited.add(nextId);

        queue.push({
          entityId: nextId,
          path: [...path, nextId],
          edges: [...edges, {
            source: entityId,
            target: nextId,
            type: relation.type,
            confidence: relation.confidence
          }]
        });
      }
    }
  }

  return {
    found: false,
    path: [],
    edges: [],
    length: -1
  };
}

/**
 * Find all paths between two entities
 * @param {string} sourceId - Source entity ID
 * @param {string} targetId - Target entity ID
 * @param {Object} options - Search options
 * @returns {Promise<Array>} All paths
 */
async function findAllPaths(sourceId, targetId, options = {}) {
  const {
    maxDepth = 4,
    relationTypes = null,
    minConfidence = 0.5,
    maxPaths = 10
  } = options;

  const allPaths = [];

  async function dfs(currentId, path, edges, visited) {
    if (currentId === targetId) {
      allPaths.push({
        path: [...path],
        edges: [...edges],
        length: path.length - 1
      });
      return;
    }

    if (path.length - 1 >= maxDepth || allPaths.length >= maxPaths) {
      return;
    }

    const relations = await relationStore.getRelations({
      source_id: currentId,
      confidence: { $gte: minConfidence }
    });

    for (const relation of relations) {
      if (relationTypes && !relationTypes.includes(relation.type)) {
        continue;
      }

      const nextId = relation.target_id;

      if (!visited.has(nextId)) {
        visited.add(nextId);

        await dfs(
          nextId,
          [...path, nextId],
          [...edges, {
            source: currentId,
            target: nextId,
            type: relation.type,
            confidence: relation.confidence
          }],
          visited
        );

        visited.delete(nextId);

        if (allPaths.length >= maxPaths) {
          break;
        }
      }
    }
  }

  const visited = new Set([sourceId]);
  await dfs(sourceId, [sourceId], [], visited);

  return allPaths;
}

/**
 * Get neighbors of an entity
 * @param {string} entityId - Entity ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Neighbors
 */
async function getNeighbors(entityId, options = {}) {
  const {
    direction = 'both', // 'outgoing' | 'incoming' | 'both'
    relationTypes = null,
    minConfidence = 0.5
  } = options;

  const result = {
    entity_id: entityId,
    outgoing: [],
    incoming: []
  };

  // Get outgoing neighbors
  if (direction === 'outgoing' || direction === 'both') {
    const outgoingRelations = await relationStore.getRelations({
      source_id: entityId,
      confidence: { $gte: minConfidence }
    });

    for (const relation of outgoingRelations) {
      if (relationTypes && !relationTypes.includes(relation.type)) {
        continue;
      }

      const neighbor = await entityStore.getEntity(relation.target_id);
      if (neighbor) {
        result.outgoing.push({
          entity: neighbor,
          relation: {
            type: relation.type,
            confidence: relation.confidence,
            weight: relation.weight
          }
        });
      }
    }
  }

  // Get incoming neighbors
  if (direction === 'incoming' || direction === 'both') {
    const incomingRelations = await relationStore.getRelations({
      target_id: entityId,
      confidence: { $gte: minConfidence }
    });

    for (const relation of incomingRelations) {
      if (relationTypes && !relationTypes.includes(relation.type)) {
        continue;
      }

      const neighbor = await entityStore.getEntity(relation.source_id);
      if (neighbor) {
        result.incoming.push({
          entity: neighbor,
          relation: {
            type: relation.type,
            confidence: relation.confidence,
            weight: relation.weight
          }
        });
      }
    }
  }

  return result;
}

/**
 * Get subgraph around an entity
 * @param {string} entityId - Center entity ID
 * @param {Object} options - Subgraph options
 * @returns {Promise<Object>} Subgraph
 */
async function getSubgraph(entityId, options = {}) {
  const {
    radius = 2,
    relationTypes = null,
    minConfidence = 0.5,
    maxNodes = 50
  } = options;

  // Use BFS to get subgraph
  return await traverseBFS(entityId, {
    maxDepth: radius,
    relationTypes,
    minConfidence,
    maxNodes
  });
}

module.exports = {
  traverseBFS,
  traverseDFS,
  findShortestPath,
  findAllPaths,
  getNeighbors,
  getSubgraph
};
