/**
 * Property-Based Tests for RelationTypeQuery
 * 
 * Tests universal properties that should hold for all query operations.
 * 
 * Feature: relation-type-expansion
 * Property 7: 查询过滤器正确性
 * Property 8: 实体类型过滤器正确性
 * 
 * **Validates: Requirements 8.4, 8.5**
 */

const fc = require('fast-check');
const RelationTypeQuery = require('./relation_type_query');
const RelationTypeRegistry = require('./relation_type_registry');
const RelationTypeLoader = require('./relation_type_loader');
const path = require('path');

describe('RelationTypeQuery Property-Based Tests', () => {
  let query;
  let registry;
  let relationTypes;

  beforeAll(() => {
    // Load actual relation types
    const loader = new RelationTypeLoader();
    const filePath = path.join(__dirname, 'relation_types.json');
    relationTypes = loader.loadFromFile(filePath);
    
    // Create registry and query
    registry = new RelationTypeRegistry();
    registry.registerBatch(relationTypes);
    query = new RelationTypeQuery(registry);
  });

  // Arbitraries for generating test data
  const domainArbitrary = () => fc.constantFrom(
    'life', 'work', 'travel', 'shopping', 'government', 'management'
  );

  const entityTypeArbitrary = () => fc.constantFrom(
    'PersonEntity',
    'OrganizationEntity',
    'LocationEntity',
    'EventEntity',
    'IndicatorEntity',
    'ProductEntity',
    'ProjectEntity',
    'DocumentEntity',
    'EquipmentEntity',
    'ResourceEntity'
  );

  const relationTypeArbitrary = () => fc.constantFrom(...relationTypes);

  /**
   * Property 7: 查询过滤器正确性
   * For any domain filter and relation type registry, querying by that domain
   * should return only relation types whose domain field equals that domain.
   * 
   * **Validates: Requirements 8.4**
   */
  describe('Property 7: Query Filter Correctness', () => {
    it('should return only relation types matching the domain filter', () => {
      fc.assert(
        fc.property(
          domainArbitrary(),
          (domain) => {
            const results = query.query({ domain });
            
            // All results should have the specified domain
            return results.every(rt => rt.domain === domain);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only relation types matching the category filter', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const results = query.query({ category: relationType.category });
            
            // All results should have the specified category
            return results.every(rt => rt.category === relationType.category);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only relation types matching the directionality filter', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (isDirectional) => {
            const results = query.query({ isDirectional });
            
            // All results should have the specified directionality
            return results.every(rt => rt.isDirectional === isDirectional);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only relation types matching the temporal filter', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (isTemporal) => {
            const results = query.query({ isTemporal });
            
            // All results should have the specified temporal property
            return results.every(rt => rt.isTemporal === isTemporal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only relation types matching multiple filters', () => {
      fc.assert(
        fc.property(
          domainArbitrary(),
          fc.boolean(),
          (domain, isDirectional) => {
            const results = query.query({ domain, isDirectional });
            
            // All results should match both filters
            return results.every(rt => 
              rt.domain === domain && rt.isDirectional === isDirectional
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return subset when applying additional filters', () => {
      fc.assert(
        fc.property(
          domainArbitrary(),
          (domain) => {
            const domainResults = query.query({ domain });
            const domainAndDirectionalResults = query.query({ 
              domain, 
              isDirectional: true 
            });
            
            // Results with additional filter should be subset of domain results
            return domainAndDirectionalResults.length <= domainResults.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no types match filters', () => {
      fc.assert(
        fc.property(
          fc.constant(true),
          () => {
            // Query with impossible combination
            const results = query.query({ 
              domain: 'nonexistent_domain'
            });
            
            return Array.isArray(results) && results.length === 0;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 8: 实体类型过滤器正确性
   * For any entity type and role (source/target), querying by that entity type
   * should return only relation types that include that entity type in the
   * corresponding entity type list.
   * 
   * **Validates: Requirements 8.5**
   */
  describe('Property 8: Entity Type Filter Correctness', () => {
    it('should return only relation types with entity type in source list when role is source', () => {
      fc.assert(
        fc.property(
          entityTypeArbitrary(),
          (entityType) => {
            const results = query.getByEntityType(entityType, 'source');
            
            // All results should have the entity type in sourceEntityTypes
            return results.every(rt => 
              rt.sourceEntityTypes.includes(entityType)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only relation types with entity type in target list when role is target', () => {
      fc.assert(
        fc.property(
          entityTypeArbitrary(),
          (entityType) => {
            const results = query.getByEntityType(entityType, 'target');
            
            // All results should have the entity type in targetEntityTypes
            return results.every(rt => 
              rt.targetEntityTypes.includes(entityType)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return relation types with entity type in either list when role is both', () => {
      fc.assert(
        fc.property(
          entityTypeArbitrary(),
          (entityType) => {
            const results = query.getByEntityType(entityType, 'both');
            
            // All results should have the entity type in either list
            return results.every(rt => 
              rt.sourceEntityTypes.includes(entityType) ||
              rt.targetEntityTypes.includes(entityType)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return compatible types for source and target entity types', () => {
      fc.assert(
        fc.property(
          entityTypeArbitrary(),
          entityTypeArbitrary(),
          (sourceType, targetType) => {
            const results = query.getCompatibleTypes(sourceType, targetType);
            
            // All results should have both entity types in correct lists
            return results.every(rt => 
              rt.sourceEntityTypes.includes(sourceType) &&
              rt.targetEntityTypes.includes(targetType)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return subset when filtering by entity type in query', () => {
      fc.assert(
        fc.property(
          entityTypeArbitrary(),
          (entityType) => {
            const allResults = query.query({});
            const filteredResults = query.query({ entityType });
            
            // Filtered results should be subset of all results
            return filteredResults.length <= allResults.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should find connecting types between two entity types', () => {
      fc.assert(
        fc.property(
          entityTypeArbitrary(),
          entityTypeArbitrary(),
          (entityType1, entityType2) => {
            const results = query.getConnectingTypes(entityType1, entityType2);
            
            // All results should connect the two entity types
            return results.every(rt => {
              const forwardMatch = 
                rt.sourceEntityTypes.includes(entityType1) &&
                rt.targetEntityTypes.includes(entityType2);
              
              const reverseMatch = !rt.isDirectional &&
                rt.sourceEntityTypes.includes(entityType2) &&
                rt.targetEntityTypes.includes(entityType1);
              
              return forwardMatch || reverseMatch;
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Additional Query Properties', () => {
    it('should return consistent results for repeated queries', () => {
      fc.assert(
        fc.property(
          domainArbitrary(),
          (domain) => {
            const results1 = query.query({ domain });
            const results2 = query.query({ domain });
            
            // Results should be identical
            return results1.length === results2.length &&
                   results1.every((rt, i) => 
                     rt.relationTypeId === results2[i].relationTypeId
                   );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all types when no filters are applied', () => {
      const allTypes = query.query({});
      expect(allTypes.length).toBe(relationTypes.length);
    });

    it('should handle search with keyword consistently', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 10 }),
          (keyword) => {
            const results = query.search(keyword);
            
            // All results should contain the keyword in some field
            return results.every(rt => {
              const lowerKeyword = keyword.toLowerCase();
              return (
                rt.name.toLowerCase().includes(lowerKeyword) ||
                rt.displayName.includes(keyword) ||
                rt.description.toLowerCase().includes(lowerKeyword) ||
                rt.relationTypeId.toLowerCase().includes(lowerKeyword)
              );
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return valid hierarchy for any relation type', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const hierarchy = query.getHierarchy(relationType.relationTypeId);
            
            // Hierarchy should exist and have the correct structure
            return hierarchy !== null &&
                   hierarchy.relationType.relationTypeId === relationType.relationTypeId &&
                   Array.isArray(hierarchy.children);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return similar types with overlapping entity types', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const similar = query.getSimilarTypes(relationType.relationTypeId);
            
            // All similar types should have overlapping entity types
            return similar.every(rt => {
              const sourceOverlap = rt.sourceEntityTypes.some(et => 
                relationType.sourceEntityTypes.includes(et)
              );
              const targetOverlap = rt.targetEntityTypes.some(et => 
                relationType.targetEntityTypes.includes(et)
              );
              
              return sourceOverlap && targetOverlap;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return recommendations within limit', () => {
      fc.assert(
        fc.property(
          entityTypeArbitrary(),
          entityTypeArbitrary(),
          fc.integer({ min: 1, max: 20 }),
          (sourceType, targetType, limit) => {
            const recommendations = query.getRecommendations({
              sourceEntityType: sourceType,
              targetEntityType: targetType
            }, limit);
            
            // Should not exceed limit
            return recommendations.length <= limit;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return types by feature correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('confidence', 'temporal', 'directional', 'bidirectional'),
          (feature) => {
            const results = query.getByFeature(feature);
            
            // All results should have the specified feature
            switch (feature) {
              case 'confidence':
                return results.every(rt => rt.supportsConfidence);
              case 'temporal':
                return results.every(rt => rt.isTemporal);
              case 'directional':
                return results.every(rt => rt.isDirectional);
              case 'bidirectional':
                return results.every(rt => !rt.isDirectional);
              default:
                return true;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return valid domain stats', () => {
      const stats = query.getDomainStats();
      
      // Stats should cover all domains
      expect(Object.keys(stats).length).toBeGreaterThan(0);
      
      // Total count should match total types
      const totalCount = Object.values(stats).reduce((sum, count) => sum + count, 0);
      expect(totalCount).toBe(relationTypes.length);
    });

    it('should return valid category stats', () => {
      const stats = query.getCategoryStats();
      
      // Stats should cover all categories
      expect(Object.keys(stats).length).toBeGreaterThan(0);
      
      // Total count should match total types
      const totalCount = Object.values(stats).reduce((sum, count) => sum + count, 0);
      expect(totalCount).toBe(relationTypes.length);
    });
  });
});
