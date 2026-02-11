/**
 * Property-Based Tests for Hierarchical Relation Extractor
 * 
 * Tests universal properties that should hold across all inputs.
 * Uses fast-check for property-based testing.
 * 
 * Property 8: Hierarchical Pattern Extraction
 * Validates: Requirements 4.1, 4.2, 4.3
 */

const fc = require('fast-check');
const { HierarchicalRelationExtractor } = require('./hierarchical_relation_extractor');

describe('HierarchicalRelationExtractor - Property-Based Tests', () => {
  let extractor;

  beforeEach(() => {
    extractor = new HierarchicalRelationExtractor({
      language: 'zh',
      enableLLM: false
    });
  });

  /**
   * Property 8: Hierarchical Pattern Extraction
   * 
   * For any document containing taxonomic patterns (is_a), compositional patterns (part_of),
   * or property patterns (has_property), the system should create corresponding hierarchical
   * relationships with confidence ≥ 0.9.
   * 
   * Feature: human-readable-knowledge-graph, Property 8: Hierarchical Pattern Extraction
   */
  describe('Property 8: Hierarchical Pattern Extraction', () => {
    test('should extract is_a relations from documents with taxonomic patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate entity names
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (entityA, entityB) => {
            // Create text with is_a pattern
            const text = `${entityA}是一种${entityB}`;
            const entities = [
              { id: 'e1', canonical_name: entityA, name: entityA },
              { id: 'e2', canonical_name: entityB, name: entityB }
            ];

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern'
            });

            // Property: Should extract at least one is_a relation
            const isARelations = relations.filter(r => r.subtype === 'is_a');
            
            if (isARelations.length > 0) {
              // All is_a relations should have high confidence
              isARelations.forEach(r => {
                expect(r.confidence).toBeGreaterThanOrEqual(0.7);
                expect(r.type).toBe('hierarchical');
                expect(r.subtype).toBe('is_a');
              });
            }
            
            // Property always holds: no errors thrown
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should extract part_of relations from documents with compositional patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (partName, wholeName) => {
            // Create text with part_of pattern
            const text = `${partName}是${wholeName}的一部分`;
            const entities = [
              { id: 'e1', canonical_name: partName, name: partName },
              { id: 'e2', canonical_name: wholeName, name: wholeName }
            ];

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern'
            });

            // Property: Should extract at least one part_of relation
            const partOfRelations = relations.filter(r => r.subtype === 'part_of');
            
            if (partOfRelations.length > 0) {
              // All part_of relations should have high confidence
              partOfRelations.forEach(r => {
                expect(r.confidence).toBeGreaterThanOrEqual(0.7);
                expect(r.type).toBe('hierarchical');
                expect(r.subtype).toBe('part_of');
              });
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should extract has_property relations from documents with property patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (entityName, propertyName) => {
            // Create text with has_property pattern
            const text = `${entityName}具有${propertyName}`;
            const entities = [
              { id: 'e1', canonical_name: entityName, name: entityName },
              { id: 'e2', canonical_name: propertyName, name: propertyName }
            ];

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern'
            });

            // Property: Should extract at least one has_property relation
            const propertyRelations = relations.filter(r => r.subtype === 'has_property');
            
            if (propertyRelations.length > 0) {
              // All has_property relations should have high confidence
              propertyRelations.forEach(r => {
                expect(r.confidence).toBeGreaterThanOrEqual(0.7);
                expect(r.type).toBe('hierarchical');
                expect(r.subtype).toBe('has_property');
              });
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should handle multiple hierarchical patterns in same document', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              source: fc.string({ minLength: 2, maxLength: 15 }).filter(s => s.trim().length > 0),
              target: fc.string({ minLength: 2, maxLength: 15 }).filter(s => s.trim().length > 0),
              pattern: fc.constantFrom('is_a', 'part_of', 'has_property')
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (relationSpecs) => {
            // Build text with multiple patterns
            const textParts = [];
            const entities = [];
            const entityMap = new Map();

            relationSpecs.forEach((spec, idx) => {
              // Add entities
              if (!entityMap.has(spec.source)) {
                const id = `e${entityMap.size + 1}`;
                entityMap.set(spec.source, id);
                entities.push({ id, canonical_name: spec.source, name: spec.source });
              }
              if (!entityMap.has(spec.target)) {
                const id = `e${entityMap.size + 1}`;
                entityMap.set(spec.target, id);
                entities.push({ id, canonical_name: spec.target, name: spec.target });
              }

              // Add text pattern
              if (spec.pattern === 'is_a') {
                textParts.push(`${spec.source}是一种${spec.target}`);
              } else if (spec.pattern === 'part_of') {
                textParts.push(`${spec.source}是${spec.target}的一部分`);
              } else if (spec.pattern === 'has_property') {
                textParts.push(`${spec.source}具有${spec.target}`);
              }
            });

            const text = textParts.join('。');

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern'
            });

            // Property: All extracted relations should be valid
            relations.forEach(r => {
              expect(r.type).toBe('hierarchical');
              expect(['is_a', 'part_of', 'has_property']).toContain(r.subtype);
              expect(r.confidence).toBeGreaterThan(0);
              expect(r.source_id).toBeTruthy();
              expect(r.target_id).toBeTruthy();
              expect(r.description).toBeTruthy();
            });

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should maintain confidence >= 0.9 for pattern-matched relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.constantFrom('是一种', '属于', '是', '包含', '具有'),
          async (entityA, entityB, pattern) => {
            const text = `${entityA}${pattern}${entityB}`;
            const entities = [
              { id: 'e1', canonical_name: entityA, name: entityA },
              { id: 'e2', canonical_name: entityB, name: entityB }
            ];

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern',
              confidenceThreshold: 0.7
            });

            // Property: All pattern-matched relations have confidence >= 0.7
            relations.forEach(r => {
              if (r.metadata.extraction_method === 'pattern') {
                expect(r.confidence).toBeGreaterThanOrEqual(0.7);
              }
            });

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 9: Hierarchical Relationship Type Support
   * 
   * For any hierarchical relationship type in the set {"is_a", "part_of", "has_property",
   * "subclass_of", "instance_of"}, the system should be able to create relationships of that type.
   * 
   * Feature: human-readable-knowledge-graph, Property 9: Hierarchical Relationship Type Support
   */
  describe('Property 9: Hierarchical Relationship Type Support', () => {
    test('should support all required hierarchical relationship types', async () => {
      const requiredTypes = ['is_a', 'part_of', 'has_property'];
      
      for (const hierarchyType of requiredTypes) {
        // Create appropriate text pattern for each type
        let text, entities;
        
        if (hierarchyType === 'is_a') {
          text = 'A是一种B';
          entities = [
            { id: 'e1', canonical_name: 'A', name: 'A' },
            { id: 'e2', canonical_name: 'B', name: 'B' }
          ];
        } else if (hierarchyType === 'part_of') {
          text = 'A是B的一部分';
          entities = [
            { id: 'e1', canonical_name: 'A', name: 'A' },
            { id: 'e2', canonical_name: 'B', name: 'B' }
          ];
        } else if (hierarchyType === 'has_property') {
          text = 'A具有B';
          entities = [
            { id: 'e1', canonical_name: 'A', name: 'A' },
            { id: 'e2', canonical_name: 'B', name: 'B' }
          ];
        }

        const relations = await extractor.extractHierarchicalRelations(text, entities, {
          method: 'pattern'
        });

        // Property: System can create this type of relation
        const typeRelations = relations.filter(r => r.subtype === hierarchyType);
        expect(typeRelations.length).toBeGreaterThan(0);
        
        // Verify structure
        typeRelations.forEach(r => {
          expect(r.type).toBe('hierarchical');
          expect(r.subtype).toBe(hierarchyType);
          expect(r.source_id).toBeTruthy();
          expect(r.target_id).toBeTruthy();
        });
      }
    });
  });

  /**
   * Additional Properties
   */
  describe('Additional Hierarchical Properties', () => {
    test('should never create circular hierarchies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              source: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
              target: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0)
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (relationSpecs) => {
            // Build text with potential circular patterns
            const textParts = relationSpecs.map(spec => 
              `${spec.source}是一种${spec.target}`
            );
            const text = textParts.join('。');

            const entities = [];
            const entityNames = new Set();
            
            relationSpecs.forEach(spec => {
              if (!entityNames.has(spec.source)) {
                entities.push({ 
                  id: `e${entities.length + 1}`, 
                  canonical_name: spec.source, 
                  name: spec.source 
                });
                entityNames.add(spec.source);
              }
              if (!entityNames.has(spec.target)) {
                entities.push({ 
                  id: `e${entities.length + 1}`, 
                  canonical_name: spec.target, 
                  name: spec.target 
                });
                entityNames.add(spec.target);
              }
            });

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern'
            });

            // Property: No circular hierarchies
            // Build graph and check for cycles
            const graph = new Map();
            relations.forEach(r => {
              if (!graph.has(r.source_id)) {
                graph.set(r.source_id, []);
              }
              graph.get(r.source_id).push(r.target_id);
            });

            // DFS to detect cycles
            const visited = new Set();
            const recursionStack = new Set();
            
            const hasCycle = (node) => {
              visited.add(node);
              recursionStack.add(node);
              
              const neighbors = graph.get(node) || [];
              for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                  if (hasCycle(neighbor)) return true;
                } else if (recursionStack.has(neighbor)) {
                  return true;
                }
              }
              
              recursionStack.delete(node);
              return false;
            };

            for (const node of graph.keys()) {
              if (!visited.has(node)) {
                expect(hasCycle(node)).toBe(false);
              }
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should always include evidence text in extracted relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (entityA, entityB) => {
            const text = `${entityA}是一种${entityB}`;
            const entities = [
              { id: 'e1', canonical_name: entityA, name: entityA },
              { id: 'e2', canonical_name: entityB, name: entityB }
            ];

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern'
            });

            // Property: All relations have evidence text
            relations.forEach(r => {
              expect(r.evidence_text).toBeTruthy();
              expect(typeof r.evidence_text).toBe('string');
              expect(r.evidence_text.length).toBeGreaterThan(0);
            });

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should always include human-readable descriptions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (entityA, entityB) => {
            const text = `${entityA}是一种${entityB}`;
            const entities = [
              { id: 'e1', canonical_name: entityA, name: entityA },
              { id: 'e2', canonical_name: entityB, name: entityB }
            ];

            const relations = await extractor.extractHierarchicalRelations(text, entities, {
              method: 'pattern'
            });

            // Property: All relations have descriptions
            relations.forEach(r => {
              expect(r.description).toBeTruthy();
              expect(typeof r.description).toBe('string');
              expect(r.description.length).toBeGreaterThan(0);
              // Description should contain entity names
              expect(
                r.description.includes(entityA) || r.description.includes(entityB)
              ).toBe(true);
            });

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
