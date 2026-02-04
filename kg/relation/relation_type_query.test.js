/**
 * Unit Tests for RelationTypeQuery
 * 
 * Tests specific examples, edge cases, and error conditions.
 * 
 * Feature: relation-type-expansion
 * **Validates: Requirements 8.4, 8.5**
 */

const RelationTypeQuery = require('./relation_type_query');
const RelationTypeRegistry = require('./relation_type_registry');

describe('RelationTypeQuery Unit Tests', () => {
  let query;
  let registry;

  beforeEach(() => {
    registry = new RelationTypeRegistry();
    query = new RelationTypeQuery(registry);

    // Register test relation types
    const testTypes = [
      {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true,
        active: true
      },
      {
        relationTypeId: 'work_employ',
        name: 'employ',
        displayName: '雇佣',
        description: '表示雇佣关系',
        domain: 'work',
        category: 'employment',
        sourceEntityTypes: ['OrganizationEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: true,
        supportsConfidence: true,
        active: true
      },
      {
        relationTypeId: 'social_friend',
        name: 'friend',
        displayName: '朋友',
        description: '表示朋友关系',
        domain: 'life',
        category: 'social',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: false,
        isTemporal: false,
        supportsConfidence: true,
        active: true
      }
    ];

    registry.registerBatch(testTypes);
  });

  describe('Constructor', () => {
    it('should create query with registry', () => {
      expect(query).toBeDefined();
      expect(query.registry).toBe(registry);
    });
  });

  describe('query', () => {
    it('should return all types when no filters provided', () => {
      const results = query.query();
      expect(results).toHaveLength(3);
    });

    it('should filter by domain', () => {
      const results = query.query({ domain: 'life' });
      expect(results).toHaveLength(2);
      expect(results.every(rt => rt.domain === 'life')).toBe(true);
    });

    it('should filter by category', () => {
      const results = query.query({ category: 'family' });
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('family_parent');
    });

    it('should filter by entity type', () => {
      const results = query.query({ entityType: 'OrganizationEntity' });
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('work_employ');
    });

    it('should filter by directionality', () => {
      const directional = query.query({ isDirectional: true });
      expect(directional).toHaveLength(2);
      
      const bidirectional = query.query({ isDirectional: false });
      expect(bidirectional).toHaveLength(1);
      expect(bidirectional[0].relationTypeId).toBe('social_friend');
    });

    it('should filter by temporal property', () => {
      const temporal = query.query({ isTemporal: true });
      expect(temporal).toHaveLength(1);
      expect(temporal[0].relationTypeId).toBe('work_employ');
    });

    it('should filter by active status', () => {
      const active = query.query({ active: true });
      expect(active).toHaveLength(3);
    });

    it('should apply multiple filters', () => {
      const results = query.query({ 
        domain: 'life', 
        isDirectional: true 
      });
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('family_parent');
    });

    it('should return empty array when no matches', () => {
      const results = query.query({ domain: 'nonexistent' });
      expect(results).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should search by English name', () => {
      const results = query.search('parent');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relationTypeId).toBe('family_parent');
    });

    it('should search by Chinese display name', () => {
      const results = query.search('朋友');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relationTypeId).toBe('social_friend');
    });

    it('should search by description', () => {
      const results = query.search('雇佣');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(rt => rt.relationTypeId === 'work_employ')).toBe(true);
    });

    it('should search by relation type ID', () => {
      const results = query.search('family');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(rt => rt.relationTypeId === 'family_parent')).toBe(true);
    });

    it('should be case insensitive for English', () => {
      const results1 = query.search('PARENT');
      const results2 = query.search('parent');
      expect(results1.length).toBe(results2.length);
    });

    it('should return empty array for null keyword', () => {
      const results = query.search(null);
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty keyword', () => {
      const results = query.search('');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for non-string keyword', () => {
      const results = query.search(123);
      expect(results).toHaveLength(0);
    });
  });

  describe('getHierarchy', () => {
    it('should return hierarchy for existing type', () => {
      const hierarchy = query.getHierarchy('family_parent');
      expect(hierarchy).toBeDefined();
      expect(hierarchy.relationType.relationTypeId).toBe('family_parent');
      expect(hierarchy.children).toBeDefined();
      expect(Array.isArray(hierarchy.children)).toBe(true);
    });

    it('should return null for non-existent type', () => {
      const hierarchy = query.getHierarchy('nonexistent');
      expect(hierarchy).toBeNull();
    });

    it('should include parent if exists', () => {
      // Add a type with parent
      registry.register({
        relationTypeId: 'family_child',
        name: 'child',
        displayName: '子女',
        description: '表示子女关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true,
        parentType: 'family_parent',
        active: true
      });

      const hierarchy = query.getHierarchy('family_child');
      expect(hierarchy.parent).toBeDefined();
      expect(hierarchy.parent.relationType.relationTypeId).toBe('family_parent');
    });

    it('should include children if exist', () => {
      // Add a child type
      registry.register({
        relationTypeId: 'family_child',
        name: 'child',
        displayName: '子女',
        description: '表示子女关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true,
        parentType: 'family_parent',
        active: true
      });

      const hierarchy = query.getHierarchy('family_parent');
      expect(hierarchy.children.length).toBeGreaterThan(0);
      expect(hierarchy.children[0].relationType.relationTypeId).toBe('family_child');
    });
  });

  describe('getCompatibleTypes', () => {
    it('should return compatible types for entity type pair', () => {
      const results = query.getCompatibleTypes('PersonEntity', 'PersonEntity');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(rt => 
        rt.sourceEntityTypes.includes('PersonEntity') &&
        rt.targetEntityTypes.includes('PersonEntity')
      )).toBe(true);
    });

    it('should return specific type for unique entity type pair', () => {
      const results = query.getCompatibleTypes('OrganizationEntity', 'PersonEntity');
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('work_employ');
    });

    it('should return empty array for incompatible types', () => {
      const results = query.getCompatibleTypes('ProductEntity', 'EquipmentEntity');
      expect(results).toHaveLength(0);
    });

    it('should return empty array when source type is null', () => {
      const results = query.getCompatibleTypes(null, 'PersonEntity');
      expect(results).toHaveLength(0);
    });

    it('should return empty array when target type is null', () => {
      const results = query.getCompatibleTypes('PersonEntity', null);
      expect(results).toHaveLength(0);
    });
  });

  describe('getByDomain', () => {
    it('should return types in domain', () => {
      const results = query.getByDomain('life');
      expect(results).toHaveLength(2);
      expect(results.every(rt => rt.domain === 'life')).toBe(true);
    });

    it('should return empty array for non-existent domain', () => {
      const results = query.getByDomain('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getByCategory', () => {
    it('should return types in category', () => {
      const results = query.getByCategory('family');
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('family');
    });

    it('should return empty array for non-existent category', () => {
      const results = query.getByCategory('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getByEntityType', () => {
    it('should return types with entity type as source', () => {
      const results = query.getByEntityType('PersonEntity', 'source');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(rt => 
        rt.sourceEntityTypes.includes('PersonEntity')
      )).toBe(true);
    });

    it('should return types with entity type as target', () => {
      const results = query.getByEntityType('PersonEntity', 'target');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(rt => 
        rt.targetEntityTypes.includes('PersonEntity')
      )).toBe(true);
    });

    it('should return types with entity type in either role', () => {
      const results = query.getByEntityType('PersonEntity', 'both');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(rt => 
        rt.sourceEntityTypes.includes('PersonEntity') ||
        rt.targetEntityTypes.includes('PersonEntity')
      )).toBe(true);
    });

    it('should default to both when role not specified', () => {
      const results = query.getByEntityType('PersonEntity');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getDomainStats', () => {
    it('should return stats for all domains', () => {
      const stats = query.getDomainStats();
      expect(stats).toBeDefined();
      expect(stats.life).toBe(2);
      expect(stats.work).toBe(1);
    });

    it('should have correct total count', () => {
      const stats = query.getDomainStats();
      const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(3);
    });
  });

  describe('getCategoryStats', () => {
    it('should return stats for all categories', () => {
      const stats = query.getCategoryStats();
      expect(stats).toBeDefined();
      expect(stats.family).toBe(1);
      expect(stats.employment).toBe(1);
      expect(stats.social).toBe(1);
    });

    it('should have correct total count', () => {
      const stats = query.getCategoryStats();
      const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(3);
    });
  });

  describe('getByFeature', () => {
    it('should return types supporting confidence', () => {
      const results = query.getByFeature('confidence');
      expect(results).toHaveLength(3);
      expect(results.every(rt => rt.supportsConfidence)).toBe(true);
    });

    it('should return temporal types', () => {
      const results = query.getByFeature('temporal');
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('work_employ');
    });

    it('should return directional types', () => {
      const results = query.getByFeature('directional');
      expect(results).toHaveLength(2);
      expect(results.every(rt => rt.isDirectional)).toBe(true);
    });

    it('should return bidirectional types', () => {
      const results = query.getByFeature('bidirectional');
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('social_friend');
    });

    it('should return empty array for unknown feature', () => {
      const results = query.getByFeature('unknown');
      expect(results).toHaveLength(0);
    });
  });

  describe('getConnectingTypes', () => {
    it('should find types connecting two entity types', () => {
      const results = query.getConnectingTypes('PersonEntity', 'PersonEntity');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find directional connections', () => {
      const results = query.getConnectingTypes('OrganizationEntity', 'PersonEntity');
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('work_employ');
    });

    it('should find bidirectional connections in both directions', () => {
      const results = query.getConnectingTypes('PersonEntity', 'PersonEntity');
      expect(results.some(rt => rt.relationTypeId === 'social_friend')).toBe(true);
    });

    it('should return empty array when no connections exist', () => {
      const results = query.getConnectingTypes('ProductEntity', 'EquipmentEntity');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for null entity types', () => {
      expect(query.getConnectingTypes(null, 'PersonEntity')).toHaveLength(0);
      expect(query.getConnectingTypes('PersonEntity', null)).toHaveLength(0);
    });
  });

  describe('getSimilarTypes', () => {
    it('should find similar types with overlapping entity types', () => {
      const results = query.getSimilarTypes('family_parent');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(rt => rt.relationTypeId !== 'family_parent')).toBe(true);
    });

    it('should return empty array for non-existent type', () => {
      const results = query.getSimilarTypes('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should not include the same type in results', () => {
      const results = query.getSimilarTypes('family_parent');
      expect(results.every(rt => rt.relationTypeId !== 'family_parent')).toBe(true);
    });
  });

  describe('advancedSearch', () => {
    it('should search with keyword only', () => {
      const results = query.advancedSearch({ keyword: 'parent' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search with filters only', () => {
      const results = query.advancedSearch({ domain: 'life' });
      expect(results).toHaveLength(2);
    });

    it('should combine keyword and filters', () => {
      const results = query.advancedSearch({ 
        keyword: 'parent',
        domain: 'life'
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(rt => rt.domain === 'life')).toBe(true);
    });

    it('should handle multiple filters', () => {
      const results = query.advancedSearch({
        domain: 'life',
        isDirectional: true
      });
      expect(results).toHaveLength(1);
      expect(results[0].relationTypeId).toBe('family_parent');
    });

    it('should return empty array when no matches', () => {
      const results = query.advancedSearch({
        keyword: 'nonexistent',
        domain: 'life'
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('getRecommendations', () => {
    it('should recommend types for entity type pair', () => {
      const results = query.getRecommendations({
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity'
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', () => {
      const results = query.getRecommendations({
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity'
      }, 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should prioritize domain if provided', () => {
      const results = query.getRecommendations({
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity',
        domain: 'life'
      });
      expect(results.length).toBeGreaterThan(0);
      // First results should be from life domain
      if (results.length > 0) {
        expect(results[0].domain).toBe('life');
      }
    });

    it('should recommend by source entity type only', () => {
      const results = query.getRecommendations({
        sourceEntityType: 'PersonEntity'
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should recommend by target entity type only', () => {
      const results = query.getRecommendations({
        targetEntityType: 'PersonEntity'
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return all types when no context provided', () => {
      const results = query.getRecommendations({});
      expect(results.length).toBeGreaterThan(0);
    });

    it('should default to limit of 10', () => {
      const results = query.getRecommendations({});
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty registry', () => {
      const emptyRegistry = new RelationTypeRegistry();
      const emptyQuery = new RelationTypeQuery(emptyRegistry);
      
      expect(emptyQuery.query()).toHaveLength(0);
      expect(emptyQuery.search('test')).toHaveLength(0);
      expect(emptyQuery.getCompatibleTypes('PersonEntity', 'PersonEntity')).toHaveLength(0);
    });

    it('should handle special characters in search', () => {
      const results = query.search('父母');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle undefined filters gracefully', () => {
      const results = query.query({ 
        domain: undefined,
        category: undefined
      });
      expect(results).toHaveLength(3);
    });
  });
});
