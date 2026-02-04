/**
 * Unit Tests for RelationTypeRegistry
 * 
 * Tests the registration and retrieval of relation types.
 * 
 * Requirements: 8.1, 8.2, 9.2
 */

const RelationTypeRegistry = require('./relation_type_registry');
const { createRelationTypeDefinition } = require('./relation_type_definition');

describe('RelationTypeRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new RelationTypeRegistry();
  });

  describe('register', () => {
    it('should register a valid relation type', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      expect(registry.has('family_parent')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should throw error for invalid relation type', () => {
      const invalidType = {
        relationTypeId: 'test'
        // Missing required fields
      };

      expect(() => registry.register(invalidType)).toThrow('Invalid relation type');
    });

    it('should throw error for duplicate relationTypeId', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      expect(() => registry.register(relationType)).toThrow('already exists');
    });

    it('should update all indexes when registering', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      expect(registry.getByDomain('life')).toHaveLength(1);
      expect(registry.getByCategory('family')).toHaveLength(1);
      expect(registry.getByEntityType('PersonEntity')).toHaveLength(1);
    });
  });

  describe('registerBatch', () => {
    it('should register multiple valid relation types', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'family_child',
          name: 'child',
          displayName: '子女',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const result = registry.registerBatch(types);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(registry.count()).toBe(2);
    });

    it('should handle mixed valid and invalid types', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        { relationTypeId: 'invalid' }, // Invalid
        createRelationTypeDefinition({
          relationTypeId: 'family_child',
          name: 'child',
          displayName: '子女',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const result = registry.registerBatch(types);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(registry.count()).toBe(2);
    });
  });

  describe('get', () => {
    it('should retrieve a registered relation type', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      const retrieved = registry.get('family_parent');
      expect(retrieved).not.toBeNull();
      expect(retrieved.relationTypeId).toBe('family_parent');
    });

    it('should return null for non-existent relation type', () => {
      const retrieved = registry.get('non_existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for registered relation type', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      expect(registry.has('family_parent')).toBe(true);
    });

    it('should return false for non-existent relation type', () => {
      expect(registry.has('non_existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all registered relation types', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'family_child',
          name: 'child',
          displayName: '子女',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      registry.registerBatch(types);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('should return empty array for empty registry', () => {
      const all = registry.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('getByDomain', () => {
    it('should return relation types for a specific domain', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'work_employ',
          name: 'employ',
          displayName: '雇佣',
          domain: 'work',
          category: 'employment',
          sourceEntityTypes: ['OrganizationEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      registry.registerBatch(types);

      const lifeTypes = registry.getByDomain('life');
      expect(lifeTypes).toHaveLength(1);
      expect(lifeTypes[0].relationTypeId).toBe('family_parent');

      const workTypes = registry.getByDomain('work');
      expect(workTypes).toHaveLength(1);
      expect(workTypes[0].relationTypeId).toBe('work_employ');
    });

    it('should return empty array for non-existent domain', () => {
      const types = registry.getByDomain('non_existent');
      expect(types).toEqual([]);
    });
  });

  describe('getByCategory', () => {
    it('should return relation types for a specific category', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'social_friend',
          name: 'friend',
          displayName: '朋友',
          domain: 'life',
          category: 'social',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      registry.registerBatch(types);

      const familyTypes = registry.getByCategory('family');
      expect(familyTypes).toHaveLength(1);
      expect(familyTypes[0].relationTypeId).toBe('family_parent');
    });

    it('should return empty array for non-existent category', () => {
      const types = registry.getByCategory('non_existent');
      expect(types).toEqual([]);
    });
  });

  describe('getByEntityType', () => {
    it('should return relation types for a specific entity type (both roles)', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      const types = registry.getByEntityType('PersonEntity', 'both');
      expect(types).toHaveLength(1);
      expect(types[0].relationTypeId).toBe('family_parent');
    });

    it('should filter by source role', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'work_employ',
        name: 'employ',
        displayName: '雇佣',
        domain: 'work',
        category: 'employment',
        sourceEntityTypes: ['OrganizationEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      const sourceTypes = registry.getByEntityType('OrganizationEntity', 'source');
      expect(sourceTypes).toHaveLength(1);

      const targetTypes = registry.getByEntityType('OrganizationEntity', 'target');
      expect(targetTypes).toHaveLength(0);
    });

    it('should filter by target role', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'work_employ',
        name: 'employ',
        displayName: '雇佣',
        domain: 'work',
        category: 'employment',
        sourceEntityTypes: ['OrganizationEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);

      const targetTypes = registry.getByEntityType('PersonEntity', 'target');
      expect(targetTypes).toHaveLength(1);

      const sourceTypes = registry.getByEntityType('PersonEntity', 'source');
      expect(sourceTypes).toHaveLength(0);
    });

    it('should return empty array for non-existent entity type', () => {
      const types = registry.getByEntityType('NonExistentEntity');
      expect(types).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'family_child',
          name: 'child',
          displayName: '子女',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'work_employ',
          name: 'employ',
          displayName: '雇佣',
          domain: 'work',
          category: 'employment',
          sourceEntityTypes: ['OrganizationEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      registry.registerBatch(types);

      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byDomain.life).toBe(2);
      expect(stats.byDomain.work).toBe(1);
      expect(stats.byCategory.family).toBe(2);
      expect(stats.byCategory.employment).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all relation types', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);
      expect(registry.count()).toBe(1);

      registry.clear();
      expect(registry.count()).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should remove a relation type and update indexes', () => {
      const relationType = createRelationTypeDefinition({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      });

      registry.register(relationType);
      expect(registry.count()).toBe(1);

      const removed = registry.remove('family_parent');
      expect(removed).toBe(true);
      expect(registry.count()).toBe(0);
      expect(registry.has('family_parent')).toBe(false);
      expect(registry.getByDomain('life')).toEqual([]);
    });

    it('should return false for non-existent relation type', () => {
      const removed = registry.remove('non_existent');
      expect(removed).toBe(false);
    });
  });

  describe('count', () => {
    it('should return the correct count', () => {
      expect(registry.count()).toBe(0);

      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'family_child',
          name: 'child',
          displayName: '子女',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      registry.registerBatch(types);
      expect(registry.count()).toBe(2);
    });
  });
});
