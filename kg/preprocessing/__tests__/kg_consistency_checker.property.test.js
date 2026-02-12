/**
 * Property-based tests for KGConsistencyChecker
 * 
 * **Feature: llm-document-index-preprocessing, Property 17: 图谱描述生成**
 * **Validates: Requirements 7.1, 7.3**
 * 
 * Property 17: For any completed knowledge graph, the system should generate a natural language
 * description that includes main entities, key relations, and graph structure summary.
 * 
 * Requirements:
 * - 7.1: Generate natural language description of knowledge graph
 * - 7.3: Include main entities, key relations, and graph structure summary in description
 */

const fc = require('fast-check');
const { KGConsistencyChecker } = require('../kg_consistency_checker');

describe('KGConsistencyChecker Property Tests', () => {
  let checker;

  beforeEach(() => {
    checker = new KGConsistencyChecker({
      temperature: 0.1,
      timeout: 5000,
      consistencyThreshold: 0.8
    });
  });

  /**
   * Arbitraries for generating test data
   */
  
  // Entity type generator
  const entityTypeArb = fc.constantFrom(
    'Location',
    'Organization',
    'Person',
    'MonitoringPoint',
    'Event',
    'Document'
  );

  // Entity generator
  const entityArb = fc.record({
    id: fc.uuid(),
    type: entityTypeArb,
    canonicalName: fc.string({ minLength: 2, maxLength: 50 }),
    name: fc.option(fc.string({ minLength: 2, maxLength: 50 }), { nil: undefined }),
    attributes: fc.option(fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.float())), { nil: undefined })
  });

  // Relation type generator
  const relationTypeArb = fc.constantFrom(
    'located_in',
    'part_of',
    'manages',
    'owns',
    'works_for',
    'monitors',
    'related_to'
  );

  // Relation generator (requires entity IDs)
  const relationArb = (entityIds) => fc.record({
    id: fc.uuid(),
    sourceId: fc.constantFrom(...entityIds),
    targetId: fc.constantFrom(...entityIds),
    type: relationTypeArb
  });

  // Graph generator
  const graphArb = fc.integer({ min: 1, max: 20 }).chain(entityCount => 
    fc.array(entityArb, { minLength: entityCount, maxLength: entityCount }).chain(entities => {
      const entityIds = entities.map(e => e.id);
      return fc.record({
        entities: fc.constant(entities),
        relations: fc.array(relationArb(entityIds), { minLength: 0, maxLength: Math.min(entityCount * 2, 30) })
      });
    })
  );

  /**
   * Property 17: 图谱描述生成
   * For any completed knowledge graph, the system should generate a natural language description
   */
  describe('Property 17: Graph Description Generation', () => {
    it('should always generate description containing entity count', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'brief');

          // Property: Description must mention entity count
          const entityCountPattern = new RegExp(`${graph.entities.length}\\s*个实体`);
          expect(description).toMatch(entityCountPattern);
        }),
        { numRuns: 100 }
      );
    });

    it('should always generate description containing relation count', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'brief');

          // Property: Description must mention relation count
          const relationCountPattern = new RegExp(`${graph.relations.length}\\s*个关系`);
          expect(description).toMatch(relationCountPattern);
        }),
        { numRuns: 100 }
      );
    });

    it('should always include main entities in detailed description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Detailed description must have "主要实体" section
          expect(description).toContain('## 主要实体');

          // Property: Should include at least some entity names (up to 10)
          const entitiesToShow = Math.min(graph.entities.length, 10);
          let foundCount = 0;
          
          for (let i = 0; i < entitiesToShow; i++) {
            const entity = graph.entities[i];
            const name = entity.canonicalName || entity.name || 'unknown';
            if (description.includes(name)) {
              foundCount++;
            }
          }

          // Property: At least some entities should be mentioned
          expect(foundCount).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should always include key relations in detailed description when relations exist', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          fc.pre(graph.relations.length > 0); // Only test graphs with relations

          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Detailed description must have "主要关系" section
          expect(description).toContain('## 主要关系');

          // Property: Should include relation types
          const relationsToShow = Math.min(graph.relations.length, 10);
          let foundCount = 0;

          for (let i = 0; i < relationsToShow; i++) {
            const relation = graph.relations[i];
            if (description.includes(relation.type)) {
              foundCount++;
            }
          }

          // Property: At least some relation types should be mentioned
          expect(foundCount).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should always include graph structure summary in detailed description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Must include structure summary sections
          expect(description).toContain('## 总体统计');
          expect(description).toContain('## 实体类型分布');
          expect(description).toContain('## 关系类型分布');

          // Property: Must show entity and relation counts
          expect(description).toContain(`实体数量：${graph.entities.length}`);
          expect(description).toContain(`关系数量：${graph.relations.length}`);
        }),
        { numRuns: 100 }
      );
    });

    it('should always show entity type distribution in description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Should show entity type counts
          const entityTypes = {};
          graph.entities.forEach(entity => {
            const type = entity.type || 'unknown';
            entityTypes[type] = (entityTypes[type] || 0) + 1;
          });

          // Property: At least the most common entity type should be mentioned
          const sortedTypes = Object.entries(entityTypes).sort((a, b) => b[1] - a[1]);
          if (sortedTypes.length > 0) {
            const [topType, topCount] = sortedTypes[0];
            expect(description).toContain(topType);
            expect(description).toContain(`${topCount}个`);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should always show relation type distribution when relations exist', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          fc.pre(graph.relations.length > 0); // Only test graphs with relations

          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Should show relation type counts
          const relationTypes = {};
          graph.relations.forEach(relation => {
            const type = relation.type || 'unknown';
            relationTypes[type] = (relationTypes[type] || 0) + 1;
          });

          // Property: At least the most common relation type should be mentioned
          const sortedTypes = Object.entries(relationTypes).sort((a, b) => b[1] - a[1]);
          if (sortedTypes.length > 0) {
            const [topType, topCount] = sortedTypes[0];
            expect(description).toContain(topType);
            expect(description).toContain(`${topCount}个`);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should always generate non-empty description for non-empty graphs', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const briefDescription = checker.generateGraphDescription(graph, 'brief');
          const detailedDescription = checker.generateGraphDescription(graph, 'detailed');

          // Property: Descriptions must be non-empty strings
          expect(briefDescription).toBeTruthy();
          expect(briefDescription.length).toBeGreaterThan(0);
          expect(detailedDescription).toBeTruthy();
          expect(detailedDescription.length).toBeGreaterThan(0);

          // Property: Detailed description should be longer than brief
          expect(detailedDescription.length).toBeGreaterThanOrEqual(briefDescription.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle graphs with only entities (no relations)', () => {
      const graphWithoutRelationsArb = fc.array(entityArb, { minLength: 1, maxLength: 20 }).map(entities => ({
        entities,
        relations: []
      }));

      fc.assert(
        fc.property(graphWithoutRelationsArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Should still generate valid description
          expect(description).toContain('## 总体统计');
          expect(description).toContain(`实体数量：${graph.entities.length}`);
          expect(description).toContain('关系数量：0');
          expect(description).toContain('## 主要实体');
        }),
        { numRuns: 100 }
      );
    });

    it('should truncate entity list when more than 10 entities', () => {
      const largeGraphArb = fc.array(entityArb, { minLength: 11, maxLength: 50 }).map(entities => ({
        entities,
        relations: []
      }));

      fc.assert(
        fc.property(largeGraphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Should indicate truncation
          const remainingCount = graph.entities.length - 10;
          expect(description).toContain(`还有 ${remainingCount} 个实体`);
        }),
        { numRuns: 100 }
      );
    });

    it('should truncate relation list when more than 10 relations', () => {
      const largeGraphArb = fc.integer({ min: 2, max: 5 }).chain(entityCount =>
        fc.array(entityArb, { minLength: entityCount, maxLength: entityCount }).chain(entities => {
          const entityIds = entities.map(e => e.id);
          return fc.record({
            entities: fc.constant(entities),
            relations: fc.array(relationArb(entityIds), { minLength: 11, maxLength: 50 })
          });
        })
      );

      fc.assert(
        fc.property(largeGraphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Should indicate truncation
          const remainingCount = graph.relations.length - 10;
          expect(description).toContain(`还有 ${remainingCount} 个关系`);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle entities without canonical names gracefully', () => {
      const entityWithoutNameArb = fc.record({
        id: fc.uuid(),
        type: entityTypeArb,
        // No canonicalName or name field
      });

      const graphArb = fc.array(entityWithoutNameArb, { minLength: 1, maxLength: 10 }).map(entities => ({
        entities,
        relations: []
      }));

      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Should not crash and should use 'unknown' for missing names
          expect(description).toBeTruthy();
          expect(description).toContain('unknown');
        }),
        { numRuns: 100 }
      );
    });

    it('should always show top 3 entity types in brief description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'brief');

          // Count entity types
          const entityTypes = {};
          graph.entities.forEach(entity => {
            const type = entity.type || 'unknown';
            entityTypes[type] = (entityTypes[type] || 0) + 1;
          });

          const sortedTypes = Object.entries(entityTypes).sort((a, b) => b[1] - a[1]);
          const topTypes = sortedTypes.slice(0, 3);

          // Property: Brief description should mention "主要实体类型" if there are entities
          if (graph.entities.length > 0) {
            expect(description).toContain('主要实体类型');
            
            // At least the top type should be mentioned
            if (topTypes.length > 0) {
              expect(description).toContain(topTypes[0][0]);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should always show top 3 relation types in brief description when relations exist', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          fc.pre(graph.relations.length > 0); // Only test graphs with relations

          const description = checker.generateGraphDescription(graph, 'brief');

          // Count relation types
          const relationTypes = {};
          graph.relations.forEach(relation => {
            const type = relation.type || 'unknown';
            relationTypes[type] = (relationTypes[type] || 0) + 1;
          });

          const sortedTypes = Object.entries(relationTypes).sort((a, b) => b[1] - a[1]);
          const topTypes = sortedTypes.slice(0, 3);

          // Property: Brief description should mention "主要关系类型"
          expect(description).toContain('主要关系类型');
          
          // At least the top type should be mentioned
          if (topTypes.length > 0) {
            expect(description).toContain(topTypes[0][0]);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Description consistency
   * The description should accurately reflect the graph structure
   */
  describe('Property: Description Accuracy', () => {
    it('should have consistent entity counts between graph and description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Entity count in description must match actual count
          expect(description).toContain(`实体数量：${graph.entities.length}`);
        }),
        { numRuns: 100 }
      );
    });

    it('should have consistent relation counts between graph and description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Property: Relation count in description must match actual count
          expect(description).toContain(`关系数量：${graph.relations.length}`);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly count entity types in description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const description = checker.generateGraphDescription(graph, 'detailed');

          // Count entity types
          const entityTypes = {};
          graph.entities.forEach(entity => {
            const type = entity.type || 'unknown';
            entityTypes[type] = (entityTypes[type] || 0) + 1;
          });

          // Property: Each entity type count in description should match actual count
          Object.entries(entityTypes).forEach(([type, count]) => {
            const pattern = new RegExp(`${type}:\\s*${count}个`);
            expect(description).toMatch(pattern);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly count relation types in description', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          fc.pre(graph.relations.length > 0); // Only test graphs with relations

          const description = checker.generateGraphDescription(graph, 'detailed');

          // Count relation types
          const relationTypes = {};
          graph.relations.forEach(relation => {
            const type = relation.type || 'unknown';
            relationTypes[type] = (relationTypes[type] || 0) + 1;
          });

          // Property: Each relation type count in description should match actual count
          Object.entries(relationTypes).forEach(([type, count]) => {
            const pattern = new RegExp(`${type}:\\s*${count}个`);
            expect(description).toMatch(pattern);
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Empty and edge cases
   */
  describe('Property: Edge Cases', () => {
    it('should handle empty graph gracefully', () => {
      const emptyGraph = {
        entities: [],
        relations: []
      };

      const briefDescription = checker.generateGraphDescription(emptyGraph, 'brief');
      const detailedDescription = checker.generateGraphDescription(emptyGraph, 'detailed');

      // Property: Should return meaningful message for empty graph
      expect(briefDescription).toContain('没有实体');
      expect(detailedDescription).toBeTruthy();
    });

    it('should handle null or undefined graph gracefully', () => {
      const nullDescription = checker.generateGraphDescription(null, 'brief');
      const undefinedDescription = checker.generateGraphDescription(undefined, 'brief');

      // Property: Should return meaningful message for invalid graph
      expect(nullDescription).toBe('空图谱');
      expect(undefinedDescription).toBe('空图谱');
    });

    it('should handle graph with missing entities array', () => {
      const invalidGraph = {
        relations: []
      };

      const description = checker.generateGraphDescription(invalidGraph, 'brief');

      // Property: Should handle gracefully
      expect(description).toBe('空图谱');
    });

    it('should handle graph with missing relations array', () => {
      const invalidGraph = {
        entities: []
      };

      const description = checker.generateGraphDescription(invalidGraph, 'brief');

      // Property: Should handle gracefully
      expect(description).toBe('空图谱');
    });
  });

  /**
   * Additional property: Detail level consistency
   */
  describe('Property: Detail Level Consistency', () => {
    it('should generate different content for brief vs detailed', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const briefDescription = checker.generateGraphDescription(graph, 'brief');
          const detailedDescription = checker.generateGraphDescription(graph, 'detailed');

          // Property: Detailed should contain markdown headers
          expect(detailedDescription).toContain('# 知识图谱描述');
          expect(detailedDescription).toContain('## 总体统计');

          // Property: Brief should not contain markdown headers
          expect(briefDescription).not.toContain('#');
        }),
        { numRuns: 100 }
      );
    });

    it('should always include more information in detailed than brief', () => {
      fc.assert(
        fc.property(graphArb, (graph) => {
          const briefDescription = checker.generateGraphDescription(graph, 'brief');
          const detailedDescription = checker.generateGraphDescription(graph, 'detailed');

          // Property: Detailed description should be longer
          expect(detailedDescription.length).toBeGreaterThanOrEqual(briefDescription.length);

          // Property: Detailed should have more lines
          const briefLines = briefDescription.split('\n').length;
          const detailedLines = detailedDescription.split('\n').length;
          expect(detailedLines).toBeGreaterThanOrEqual(briefLines);
        }),
        { numRuns: 100 }
      );
    });
  });
});
