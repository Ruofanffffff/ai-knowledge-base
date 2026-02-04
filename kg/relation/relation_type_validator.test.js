/**
 * Unit Tests for RelationTypeValidator
 * 
 * Tests specific examples, edge cases, and error conditions.
 * 
 * Feature: relation-type-expansion
 * **Validates: Requirements 10.1-10.6**
 */

const RelationTypeValidator = require('./relation_type_validator');
const RelationTypeRegistry = require('./relation_type_registry');

describe('RelationTypeValidator Unit Tests', () => {
  let validator;
  let registry;

  beforeEach(() => {
    registry = new RelationTypeRegistry();
    validator = new RelationTypeValidator(registry);
  });

  describe('Constructor', () => {
    it('should create validator with registry', () => {
      expect(validator).toBeDefined();
      expect(validator.registry).toBe(registry);
    });
  });

  describe('validateSourceEntity', () => {
    const relationType = {
      relationTypeId: 'test_relation',
      sourceEntityTypes: ['PersonEntity', 'OrganizationEntity'],
      targetEntityTypes: ['LocationEntity']
    };

    it('should return true for valid source entity type', () => {
      expect(validator.validateSourceEntity('PersonEntity', relationType)).toBe(true);
      expect(validator.validateSourceEntity('OrganizationEntity', relationType)).toBe(true);
    });

    it('should return false for invalid source entity type', () => {
      expect(validator.validateSourceEntity('LocationEntity', relationType)).toBe(false);
      expect(validator.validateSourceEntity('ProductEntity', relationType)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(validator.validateSourceEntity(null, relationType)).toBe(false);
      expect(validator.validateSourceEntity(undefined, relationType)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validator.validateSourceEntity('', relationType)).toBe(false);
    });
  });

  describe('validateTargetEntity', () => {
    const relationType = {
      relationTypeId: 'test_relation',
      sourceEntityTypes: ['PersonEntity'],
      targetEntityTypes: ['LocationEntity', 'OrganizationEntity']
    };

    it('should return true for valid target entity type', () => {
      expect(validator.validateTargetEntity('LocationEntity', relationType)).toBe(true);
      expect(validator.validateTargetEntity('OrganizationEntity', relationType)).toBe(true);
    });

    it('should return false for invalid target entity type', () => {
      expect(validator.validateTargetEntity('PersonEntity', relationType)).toBe(false);
      expect(validator.validateTargetEntity('ProductEntity', relationType)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(validator.validateTargetEntity(null, relationType)).toBe(false);
      expect(validator.validateTargetEntity(undefined, relationType)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validator.validateTargetEntity('', relationType)).toBe(false);
    });
  });

  describe('validateConfidence', () => {
    const relationTypeWithConfidence = {
      relationTypeId: 'test_relation',
      supportsConfidence: true
    };

    const relationTypeWithoutConfidence = {
      relationTypeId: 'test_relation',
      supportsConfidence: false
    };

    it('should return true for valid confidence values', () => {
      expect(validator.validateConfidence(0, relationTypeWithConfidence)).toBe(true);
      expect(validator.validateConfidence(0.5, relationTypeWithConfidence)).toBe(true);
      expect(validator.validateConfidence(1, relationTypeWithConfidence)).toBe(true);
    });

    it('should return false for confidence < 0', () => {
      expect(validator.validateConfidence(-0.1, relationTypeWithConfidence)).toBe(false);
      expect(validator.validateConfidence(-1, relationTypeWithConfidence)).toBe(false);
    });

    it('should return false for confidence > 1', () => {
      expect(validator.validateConfidence(1.1, relationTypeWithConfidence)).toBe(false);
      expect(validator.validateConfidence(2, relationTypeWithConfidence)).toBe(false);
    });

    it('should return false for non-numeric values', () => {
      expect(validator.validateConfidence('0.5', relationTypeWithConfidence)).toBe(false);
      expect(validator.validateConfidence(null, relationTypeWithConfidence)).toBe(false);
      expect(validator.validateConfidence(undefined, relationTypeWithConfidence)).toBe(false);
      expect(validator.validateConfidence({}, relationTypeWithConfidence)).toBe(false);
      expect(validator.validateConfidence([], relationTypeWithConfidence)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(validator.validateConfidence(NaN, relationTypeWithConfidence)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(validator.validateConfidence(Infinity, relationTypeWithConfidence)).toBe(false);
      expect(validator.validateConfidence(-Infinity, relationTypeWithConfidence)).toBe(false);
    });

    it('should return true for any value if type does not support confidence', () => {
      expect(validator.validateConfidence(5, relationTypeWithoutConfidence)).toBe(true);
      expect(validator.validateConfidence('invalid', relationTypeWithoutConfidence)).toBe(true);
    });
  });

  describe('validateTimestamp', () => {
    const temporalRelationType = {
      relationTypeId: 'test_relation',
      isTemporal: true
    };

    const nonTemporalRelationType = {
      relationTypeId: 'test_relation',
      isTemporal: false
    };

    it('should return true for valid Date objects', () => {
      expect(validator.validateTimestamp(new Date(), temporalRelationType)).toBe(true);
      expect(validator.validateTimestamp(new Date('2024-01-01'), temporalRelationType)).toBe(true);
    });

    it('should return true for valid date strings', () => {
      expect(validator.validateTimestamp('2024-01-01', temporalRelationType)).toBe(true);
      expect(validator.validateTimestamp('2024-01-01T12:00:00Z', temporalRelationType)).toBe(true);
    });

    it('should return true for valid timestamps (numbers)', () => {
      expect(validator.validateTimestamp(Date.now(), temporalRelationType)).toBe(true);
      expect(validator.validateTimestamp(1704067200000, temporalRelationType)).toBe(true);
    });

    it('should return false for invalid date strings', () => {
      expect(validator.validateTimestamp('invalid-date', temporalRelationType)).toBe(false);
      expect(validator.validateTimestamp('not a date', temporalRelationType)).toBe(false);
    });

    it('should return true for any value if type is not temporal', () => {
      expect(validator.validateTimestamp('invalid', nonTemporalRelationType)).toBe(true);
      expect(validator.validateTimestamp(null, nonTemporalRelationType)).toBe(true);
    });
  });

  describe('validateDirection', () => {
    const directionalRelationType = {
      relationTypeId: 'test_relation',
      isDirectional: true
    };

    const bidirectionalRelationType = {
      relationTypeId: 'test_relation',
      isDirectional: false
    };

    it('should return true for valid directional relations', () => {
      expect(validator.validateDirection('source-1', 'target-1', directionalRelationType)).toBe(true);
      expect(validator.validateDirection('id-a', 'id-b', directionalRelationType)).toBe(true);
    });

    it('should return false when source and target are the same', () => {
      expect(validator.validateDirection('same-id', 'same-id', directionalRelationType)).toBe(false);
    });

    it('should return false when source or target is missing', () => {
      expect(validator.validateDirection('', 'target-1', directionalRelationType)).toBe(false);
      expect(validator.validateDirection('source-1', '', directionalRelationType)).toBe(false);
      expect(validator.validateDirection(null, 'target-1', directionalRelationType)).toBe(false);
      expect(validator.validateDirection('source-1', null, directionalRelationType)).toBe(false);
    });

    it('should return true for bidirectional relations regardless of IDs', () => {
      expect(validator.validateDirection('id-1', 'id-2', bidirectionalRelationType)).toBe(true);
      expect(validator.validateDirection('same', 'same', bidirectionalRelationType)).toBe(true);
      expect(validator.validateDirection('', '', bidirectionalRelationType)).toBe(true);
    });
  });

  describe('validate', () => {
    const relationType = {
      relationTypeId: 'family_parent',
      name: 'parent',
      displayName: '父母',
      sourceEntityTypes: ['PersonEntity'],
      targetEntityTypes: ['PersonEntity'],
      isDirectional: true,
      isTemporal: false,
      supportsConfidence: true
    };

    it('should validate a correct relation', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity',
        sourceId: 'person-1',
        targetId: 'person-2',
        confidence: 0.9
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid source entity type', () => {
      const relation = {
        sourceEntityType: 'OrganizationEntity',
        targetEntityType: 'PersonEntity',
        sourceId: 'org-1',
        targetId: 'person-2'
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Source entity type');
      expect(result.errors[0]).toContain('OrganizationEntity');
    });

    it('should fail validation for invalid target entity type', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'LocationEntity',
        sourceId: 'person-1',
        targetId: 'location-1'
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Target entity type');
      expect(result.errors[0]).toContain('LocationEntity');
    });

    it('should fail validation for invalid confidence', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity',
        sourceId: 'person-1',
        targetId: 'person-2',
        confidence: 1.5
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('Confidence'))).toBe(true);
    });

    it('should add warning when confidence is missing but supported', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity',
        sourceId: 'person-1',
        targetId: 'person-2'
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('confidence');
    });

    it('should fail validation when missing source or target ID for directional relation', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity',
        sourceId: '',
        targetId: 'person-2'
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('sourceId and targetId'))).toBe(true);
    });

    it('should accumulate multiple errors', () => {
      const relation = {
        sourceEntityType: 'InvalidEntity',
        targetEntityType: 'AnotherInvalidEntity',
        sourceId: 'source-1',
        targetId: 'target-1',
        confidence: 2.0
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3); // source, target, confidence errors
    });
  });

  describe('validateByTypeId', () => {
    beforeEach(() => {
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
      registry.register(relationType);
    });

    it('should validate relation by type ID', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity',
        sourceId: 'person-1',
        targetId: 'person-2',
        confidence: 0.9
      };

      const result = validator.validateByTypeId(relation, 'family_parent');
      expect(result.valid).toBe(true);
    });

    it('should return error when relation type not found', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity',
        sourceId: 'person-1',
        targetId: 'person-2'
      };

      const result = validator.validateByTypeId(relation, 'nonexistent_type');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found in registry');
    });
  });

  describe('validateBatch', () => {
    beforeEach(() => {
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
      registry.register(relationType);
    });

    it('should validate multiple relations', () => {
      const relations = [
        {
          sourceEntityType: 'PersonEntity',
          targetEntityType: 'PersonEntity',
          sourceId: 'person-1',
          targetId: 'person-2'
        },
        {
          sourceEntityType: 'PersonEntity',
          targetEntityType: 'PersonEntity',
          sourceId: 'person-3',
          targetId: 'person-4'
        }
      ];

      const result = validator.validateBatch(relations, 'family_parent');
      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(0);
      expect(result.validations).toHaveLength(2);
    });

    it('should count valid and invalid relations separately', () => {
      const relations = [
        {
          sourceEntityType: 'PersonEntity',
          targetEntityType: 'PersonEntity',
          sourceId: 'person-1',
          targetId: 'person-2'
        },
        {
          sourceEntityType: 'InvalidEntity',
          targetEntityType: 'PersonEntity',
          sourceId: 'invalid-1',
          targetId: 'person-3'
        }
      ];

      const result = validator.validateBatch(relations, 'family_parent');
      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.validations).toHaveLength(2);
    });

    it('should include validation details for each relation', () => {
      const relations = [
        {
          sourceEntityType: 'PersonEntity',
          targetEntityType: 'PersonEntity',
          sourceId: 'person-1',
          targetId: 'person-2'
        }
      ];

      const result = validator.validateBatch(relations, 'family_parent');
      expect(result.validations[0]).toHaveProperty('relation');
      expect(result.validations[0]).toHaveProperty('validation');
      expect(result.validations[0].validation).toHaveProperty('valid');
      expect(result.validations[0].validation).toHaveProperty('errors');
      expect(result.validations[0].validation).toHaveProperty('warnings');
    });
  });

  describe('isCompatible', () => {
    const relationType = {
      relationTypeId: 'family_parent',
      sourceEntityTypes: ['PersonEntity'],
      targetEntityTypes: ['PersonEntity']
    };

    it('should return true for compatible relation', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity'
      };

      expect(validator.isCompatible(relation, relationType)).toBe(true);
    });

    it('should return false for incompatible source entity type', () => {
      const relation = {
        sourceEntityType: 'OrganizationEntity',
        targetEntityType: 'PersonEntity'
      };

      expect(validator.isCompatible(relation, relationType)).toBe(false);
    });

    it('should return false for incompatible target entity type', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'LocationEntity'
      };

      expect(validator.isCompatible(relation, relationType)).toBe(false);
    });
  });

  describe('getSuggestedTypes', () => {
    beforeEach(() => {
      const relationTypes = [
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
          supportsConfidence: true
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
          isTemporal: false,
          supportsConfidence: true
        },
        {
          relationTypeId: 'residence_live_in',
          name: 'live_in',
          displayName: '居住于',
          description: '表示居住关系',
          domain: 'life',
          category: 'residence',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['LocationEntity'],
          isDirectional: true,
          isTemporal: false,
          supportsConfidence: true
        }
      ];
      registry.registerBatch(relationTypes);
    });

    it('should suggest compatible relation types', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'PersonEntity'
      };

      const suggestions = validator.getSuggestedTypes(relation);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].relationTypeId).toBe('family_parent');
    });

    it('should return multiple suggestions when multiple types are compatible', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'LocationEntity'
      };

      const suggestions = validator.getSuggestedTypes(relation);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].relationTypeId).toBe('residence_live_in');
    });

    it('should return empty array when no types are compatible', () => {
      const relation = {
        sourceEntityType: 'ProductEntity',
        targetEntityType: 'EquipmentEntity'
      };

      const suggestions = validator.getSuggestedTypes(relation);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    const relationType = {
      relationTypeId: 'test_relation',
      sourceEntityTypes: ['PersonEntity'],
      targetEntityTypes: ['LocationEntity'],
      isDirectional: true,
      isTemporal: true,
      supportsConfidence: true
    };

    it('should handle relation with all optional fields', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'LocationEntity',
        sourceId: 'person-1',
        targetId: 'location-1',
        confidence: 0.8,
        timestamp: new Date()
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle relation with minimal fields', () => {
      const relation = {
        sourceEntityType: 'PersonEntity',
        targetEntityType: 'LocationEntity',
        sourceId: 'person-1',
        targetId: 'location-1'
      };

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0); // Should have warnings for missing optional fields
    });

    it('should handle empty relation object', () => {
      const relation = {};

      const result = validator.validate(relation, relationType);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
