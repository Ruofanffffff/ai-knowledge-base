/**
 * Unit Tests for RelationTypeDefinition
 * 
 * Tests the data structure creation and validation for relation types.
 * 
 * Requirements: 7.1-7.10
 */

const {
  VALID_DOMAINS,
  createRelationTypeDefinition,
  validateRelationTypeDefinition,
  hasRequiredMetadata,
  normalizeRelationTypeDefinition,
  areRelationTypesEqual
} = require('./relation_type_definition');

describe('RelationTypeDefinition', () => {
  describe('createRelationTypeDefinition', () => {
    it('should create a valid relation type definition with all required fields', () => {
      const config = {
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
        supportsConfidence: true
      };

      const relationType = createRelationTypeDefinition(config);

      expect(relationType.relationTypeId).toBe('family_parent');
      expect(relationType.name).toBe('parent');
      expect(relationType.displayName).toBe('父母');
      expect(relationType.description).toBe('表示父母关系');
      expect(relationType.domain).toBe('life');
      expect(relationType.category).toBe('family');
      expect(relationType.sourceEntityTypes).toEqual(['PersonEntity']);
      expect(relationType.targetEntityTypes).toEqual(['PersonEntity']);
      expect(relationType.isDirectional).toBe(true);
      expect(relationType.isTemporal).toBe(false);
      expect(relationType.supportsConfidence).toBe(true);
      expect(relationType.version).toBe('1.0.0');
      expect(relationType.active).toBe(true);
      expect(relationType.createdAt).toBeInstanceOf(Date);
      expect(relationType.updatedAt).toBeInstanceOf(Date);
    });

    it('should use default values for optional fields', () => {
      const config = {
        relationTypeId: 'test_relation',
        name: 'test',
        displayName: '测试',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB']
      };

      const relationType = createRelationTypeDefinition(config);

      expect(relationType.description).toBe('');
      expect(relationType.isDirectional).toBe(true);
      expect(relationType.isTemporal).toBe(false);
      expect(relationType.supportsConfidence).toBe(true);
      expect(relationType.parentType).toBe(null);
      expect(relationType.metadata).toEqual({});
      expect(relationType.version).toBe('1.0.0');
      expect(relationType.active).toBe(true);
    });

    it('should handle empty arrays for entity types', () => {
      const config = {
        relationTypeId: 'test_relation',
        name: 'test',
        displayName: '测试',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: [],
        targetEntityTypes: []
      };

      const relationType = createRelationTypeDefinition(config);

      expect(relationType.sourceEntityTypes).toEqual([]);
      expect(relationType.targetEntityTypes).toEqual([]);
    });

    it('should handle custom metadata', () => {
      const config = {
        relationTypeId: 'test_relation',
        name: 'test',
        displayName: '测试',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB'],
        metadata: { custom: 'value', priority: 1 }
      };

      const relationType = createRelationTypeDefinition(config);

      expect(relationType.metadata).toEqual({ custom: 'value', priority: 1 });
    });
  });

  describe('validateRelationTypeDefinition', () => {
    it('should validate a complete and correct relation type', () => {
      const relationType = {
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
        supportsConfidence: true
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const relationType = {
        relationTypeId: 'test_relation',
        name: 'test'
        // Missing other required fields
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('displayName'))).toBe(true);
      expect(result.errors.some(e => e.includes('domain'))).toBe(true);
    });

    it('should detect null values in required fields', () => {
      const relationType = {
        relationTypeId: null,
        name: 'test',
        displayName: '测试',
        description: '描述',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('relationTypeId'))).toBe(true);
    });

    it('should detect undefined values in required fields', () => {
      const relationType = {
        relationTypeId: 'test_relation',
        name: 'test',
        displayName: '测试',
        description: '描述',
        domain: undefined,
        category: 'test',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('domain'))).toBe(true);
    });

    it('should detect invalid field types', () => {
      const relationType = {
        relationTypeId: 123, // Should be string
        name: 'test',
        displayName: '测试',
        description: '描述',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: 'not-an-array', // Should be array
        targetEntityTypes: ['EntityB'],
        isDirectional: 'yes', // Should be boolean
        isTemporal: false,
        supportsConfidence: true
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('relationTypeId'))).toBe(true);
      expect(result.errors.some(e => e.includes('sourceEntityTypes'))).toBe(true);
      expect(result.errors.some(e => e.includes('isDirectional'))).toBe(true);
    });

    it('should detect invalid domain values', () => {
      const relationType = {
        relationTypeId: 'test_relation',
        name: 'test',
        displayName: '测试',
        description: '描述',
        domain: 'invalid_domain',
        category: 'test',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid domain'))).toBe(true);
    });

    it('should detect empty entity type arrays', () => {
      const relationType = {
        relationTypeId: 'test_relation',
        name: 'test',
        displayName: '测试',
        description: '描述',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: [],
        targetEntityTypes: [],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('sourceEntityTypes'))).toBe(true);
      expect(result.errors.some(e => e.includes('targetEntityTypes'))).toBe(true);
    });

    it('should detect relationTypeId that is too short', () => {
      const relationType = {
        relationTypeId: 'ab', // Too short
        name: 'test',
        displayName: '测试',
        description: '描述',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      const result = validateRelationTypeDefinition(relationType);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 3 characters'))).toBe(true);
    });

    it('should validate all valid domains', () => {
      VALID_DOMAINS.forEach(domain => {
        const relationType = {
          relationTypeId: 'test_relation',
          name: 'test',
          displayName: '测试',
          description: '描述',
          domain: domain,
          category: 'test',
          sourceEntityTypes: ['EntityA'],
          targetEntityTypes: ['EntityB'],
          isDirectional: true,
          isTemporal: false,
          supportsConfidence: true
        };

        const result = validateRelationTypeDefinition(relationType);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('hasRequiredMetadata', () => {
    it('should return true for complete metadata', () => {
      const relationType = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      expect(hasRequiredMetadata(relationType)).toBe(true);
    });

    it('should return false for missing fields', () => {
      const relationType = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母'
        // Missing other required fields
      };

      expect(hasRequiredMetadata(relationType)).toBe(false);
    });

    it('should return false for null values', () => {
      const relationType = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: null,
        domain: 'life',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      expect(hasRequiredMetadata(relationType)).toBe(false);
    });

    it('should return false for undefined values', () => {
      const relationType = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: undefined,
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };

      expect(hasRequiredMetadata(relationType)).toBe(false);
    });
  });

  describe('normalizeRelationTypeDefinition', () => {
    it('should normalize a complete relation type', () => {
      const relationType = {
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
        supportsConfidence: true
      };

      const normalized = normalizeRelationTypeDefinition(relationType);

      expect(normalized.relationTypeId).toBe('family_parent');
      expect(normalized.version).toBe('1.0.0');
      expect(normalized.active).toBe(true);
      expect(normalized.parentType).toBe(null);
      expect(normalized.metadata).toEqual({});
    });

    it('should provide defaults for missing fields', () => {
      const relationType = {
        relationTypeId: 'test_relation'
      };

      const normalized = normalizeRelationTypeDefinition(relationType);

      expect(normalized.relationTypeId).toBe('test_relation');
      expect(normalized.name).toBe('');
      expect(normalized.displayName).toBe('');
      expect(normalized.description).toBe('');
      expect(normalized.domain).toBe('');
      expect(normalized.category).toBe('');
      expect(normalized.sourceEntityTypes).toEqual([]);
      expect(normalized.targetEntityTypes).toEqual([]);
      expect(normalized.isDirectional).toBe(true);
      expect(normalized.isTemporal).toBe(false);
      expect(normalized.supportsConfidence).toBe(true);
      expect(normalized.parentType).toBe(null);
      expect(normalized.metadata).toEqual({});
      expect(normalized.version).toBe('1.0.0');
      expect(normalized.active).toBe(true);
    });

    it('should convert non-array entity types to empty arrays', () => {
      const relationType = {
        relationTypeId: 'test_relation',
        sourceEntityTypes: 'not-an-array',
        targetEntityTypes: null
      };

      const normalized = normalizeRelationTypeDefinition(relationType);

      expect(normalized.sourceEntityTypes).toEqual([]);
      expect(normalized.targetEntityTypes).toEqual([]);
    });

    it('should preserve existing dates', () => {
      const createdAt = new Date('2023-01-01');
      const updatedAt = new Date('2023-06-01');
      
      const relationType = {
        relationTypeId: 'test_relation',
        createdAt,
        updatedAt
      };

      const normalized = normalizeRelationTypeDefinition(relationType);

      expect(normalized.createdAt).toBe(createdAt);
      expect(normalized.updatedAt).toBe(updatedAt);
    });
  });

  describe('areRelationTypesEqual', () => {
    it('should return true for equal relation types', () => {
      const type1 = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };

      const type2 = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };

      expect(areRelationTypesEqual(type1, type2)).toBe(true);
    });

    it('should return false for different relationTypeIds', () => {
      const type1 = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };

      const type2 = {
        relationTypeId: 'family_child',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };

      expect(areRelationTypesEqual(type1, type2)).toBe(false);
    });

    it('should return false for null or undefined inputs', () => {
      const type1 = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };

      expect(areRelationTypesEqual(type1, null)).toBe(false);
      expect(areRelationTypesEqual(null, type1)).toBe(false);
      expect(areRelationTypesEqual(null, null)).toBe(false);
      expect(areRelationTypesEqual(type1, undefined)).toBe(false);
    });

    it('should return false for different names', () => {
      const type1 = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };

      const type2 = {
        relationTypeId: 'family_parent',
        name: 'child',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };

      expect(areRelationTypesEqual(type1, type2)).toBe(false);
    });
  });

  describe('VALID_DOMAINS', () => {
    it('should contain all expected domains', () => {
      expect(VALID_DOMAINS).toContain('life');
      expect(VALID_DOMAINS).toContain('work');
      expect(VALID_DOMAINS).toContain('travel');
      expect(VALID_DOMAINS).toContain('shopping');
      expect(VALID_DOMAINS).toContain('government');
      expect(VALID_DOMAINS).toContain('management');
      expect(VALID_DOMAINS).toHaveLength(6);
    });
  });
});
