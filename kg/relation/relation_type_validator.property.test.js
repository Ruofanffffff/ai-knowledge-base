/**
 * Property-Based Tests for RelationTypeValidator
 * 
 * Tests universal properties that should hold for all relation validations.
 * 
 * Feature: relation-type-expansion
 * Property 4: 实体类型约束验证
 * Property 5: 目标实体类型约束验证
 * Property 6: 置信度范围验证
 * Property 11: 验证错误信息清晰性
 * 
 * **Validates: Requirements 10.1, 10.2, 10.4, 10.6**
 */

const fc = require('fast-check');
const RelationTypeValidator = require('./relation_type_validator');
const RelationTypeRegistry = require('./relation_type_registry');
const RelationTypeLoader = require('./relation_type_loader');
const path = require('path');

describe('RelationTypeValidator Property-Based Tests', () => {
  let validator;
  let registry;
  let relationTypes;

  beforeAll(() => {
    // Load actual relation types
    const loader = new RelationTypeLoader();
    const filePath = path.join(__dirname, 'relation_types.json');
    relationTypes = loader.loadFromFile(filePath);
    
    // Create registry and validator
    registry = new RelationTypeRegistry();
    registry.registerBatch(relationTypes);
    validator = new RelationTypeValidator(registry);
  });

  // Arbitraries for generating test data
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

  const invalidEntityTypeArbitrary = () => fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => ![
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
    ].includes(s));

  const confidenceArbitrary = () => fc.double({ min: 0, max: 1, noNaN: true });

  const invalidConfidenceArbitrary = () => fc.oneof(
    fc.double({ min: -10, max: -0.001 }),
    fc.double({ min: 1.001, max: 10 }),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity)
  );

  const relationTypeArbitrary = () => fc.constantFrom(...relationTypes);

  const relationInstanceArbitrary = (relationType) => fc.record({
    sourceEntityType: fc.constantFrom(...relationType.sourceEntityTypes),
    targetEntityType: fc.constantFrom(...relationType.targetEntityTypes),
    sourceId: fc.uuid(),
    targetId: fc.uuid(),
    confidence: relationType.supportsConfidence ? confidenceArbitrary() : fc.constant(undefined),
    timestamp: relationType.isTemporal ? fc.date() : fc.constant(undefined)
  });

  /**
   * Property 4: 实体类型约束验证
   * For any relation instance and its corresponding relation type definition,
   * if the relation instance's source entity type is not in the relation type's
   * sourceEntityTypes list, then validation should fail.
   * 
   * **Validates: Requirements 10.1**
   */
  describe('Property 4: Source Entity Type Constraint Validation', () => {
    it('should fail validation when source entity type is not in allowed list', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          entityTypeArbitrary(),
          fc.uuid(),
          fc.uuid(),
          (relationType, invalidSourceType, validTargetType, sourceId, targetId) => {
            // Skip if the invalid type happens to be in the allowed list
            if (relationType.sourceEntityTypes.includes(invalidSourceType)) {
              return true;
            }

            // Ensure target type is valid
            const targetType = relationType.targetEntityTypes.includes(validTargetType)
              ? validTargetType
              : relationType.targetEntityTypes[0];

            const relation = {
              sourceEntityType: invalidSourceType,
              targetEntityType: targetType,
              sourceId,
              targetId
            };

            const result = validator.validate(relation, relationType);
            
            // Validation should fail
            return !result.valid && result.errors.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass validation when source entity type is in allowed list', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const relation = {
              sourceEntityType: relationType.sourceEntityTypes[0],
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456'
            };

            const result = validator.validate(relation, relationType);
            
            // Should not have source entity type error
            const hasSourceError = result.errors.some(err => 
              err.includes('Source entity type') && err.includes('not allowed')
            );
            
            return !hasSourceError;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify invalid source entity types', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          (relationType, invalidType) => {
            // Skip if the invalid type happens to be in the allowed list
            if (relationType.sourceEntityTypes.includes(invalidType)) {
              return true;
            }

            const isValid = validator.validateSourceEntity(invalidType, relationType);
            return !isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: 目标实体类型约束验证
   * For any relation instance and its corresponding relation type definition,
   * if the relation instance's target entity type is not in the relation type's
   * targetEntityTypes list, then validation should fail.
   * 
   * **Validates: Requirements 10.2**
   */
  describe('Property 5: Target Entity Type Constraint Validation', () => {
    it('should fail validation when target entity type is not in allowed list', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          entityTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          fc.uuid(),
          fc.uuid(),
          (relationType, validSourceType, invalidTargetType, sourceId, targetId) => {
            // Skip if the invalid type happens to be in the allowed list
            if (relationType.targetEntityTypes.includes(invalidTargetType)) {
              return true;
            }

            // Ensure source type is valid
            const sourceType = relationType.sourceEntityTypes.includes(validSourceType)
              ? validSourceType
              : relationType.sourceEntityTypes[0];

            const relation = {
              sourceEntityType: sourceType,
              targetEntityType: invalidTargetType,
              sourceId,
              targetId
            };

            const result = validator.validate(relation, relationType);
            
            // Validation should fail
            return !result.valid && result.errors.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass validation when target entity type is in allowed list', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const relation = {
              sourceEntityType: relationType.sourceEntityTypes[0],
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456'
            };

            const result = validator.validate(relation, relationType);
            
            // Should not have target entity type error
            const hasTargetError = result.errors.some(err => 
              err.includes('Target entity type') && err.includes('not allowed')
            );
            
            return !hasTargetError;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify invalid target entity types', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          (relationType, invalidType) => {
            // Skip if the invalid type happens to be in the allowed list
            if (relationType.targetEntityTypes.includes(invalidType)) {
              return true;
            }

            const isValid = validator.validateTargetEntity(invalidType, relationType);
            return !isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: 置信度范围验证
   * For any relation instance, if its relation type supports confidence
   * (supportsConfidence is true), then the confidence value must be between
   * 0 and 1 (inclusive).
   * 
   * **Validates: Requirements 10.4**
   */
  describe('Property 6: Confidence Range Validation', () => {
    it('should fail validation when confidence is outside [0, 1] range', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary().filter(rt => rt.supportsConfidence),
          invalidConfidenceArbitrary(),
          (relationType, invalidConfidence) => {
            const relation = {
              sourceEntityType: relationType.sourceEntityTypes[0],
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456',
              confidence: invalidConfidence
            };

            const result = validator.validate(relation, relationType);
            
            // Validation should fail with confidence error
            const hasConfidenceError = result.errors.some(err => 
              err.includes('Confidence') && err.includes('invalid')
            );
            
            return !result.valid && hasConfidenceError;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass validation when confidence is in [0, 1] range', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary().filter(rt => rt.supportsConfidence),
          confidenceArbitrary(),
          (relationType, validConfidence) => {
            const relation = {
              sourceEntityType: relationType.sourceEntityTypes[0],
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456',
              confidence: validConfidence
            };

            const result = validator.validate(relation, relationType);
            
            // Should not have confidence error
            const hasConfidenceError = result.errors.some(err => 
              err.includes('Confidence') && err.includes('invalid')
            );
            
            return !hasConfidenceError;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept confidence values at boundaries (0 and 1)', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary().filter(rt => rt.supportsConfidence),
          fc.constantFrom(0, 1),
          (relationType, boundaryConfidence) => {
            const isValid = validator.validateConfidence(boundaryConfidence, relationType);
            return isValid;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-numeric confidence values', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary().filter(rt => rt.supportsConfidence),
          fc.oneof(
            fc.constant('0.5'),
            fc.constant(null),
            fc.constant({}),
            fc.constant([])
          ),
          (relationType, nonNumericConfidence) => {
            const isValid = validator.validateConfidence(nonNumericConfidence, relationType);
            return !isValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 11: 验证错误信息清晰性
   * For any invalid relation instance, validation failure should return
   * clear error messages that include specific failure reasons
   * (e.g., "source entity type mismatch", "confidence out of range", etc.)
   * 
   * **Validates: Requirements 10.6**
   */
  describe('Property 11: Validation Error Message Clarity', () => {
    it('should provide clear error messages for source entity type violations', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          (relationType, invalidType) => {
            // Skip if the invalid type happens to be in the allowed list
            if (relationType.sourceEntityTypes.includes(invalidType)) {
              return true;
            }

            const relation = {
              sourceEntityType: invalidType,
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456'
            };

            const result = validator.validate(relation, relationType);
            
            if (result.valid) {
              return false; // Should have failed
            }

            // Error message should mention:
            // 1. The invalid entity type
            // 2. The relation type ID
            // 3. The allowed types
            const hasSourceError = result.errors.some(err => {
              return err.includes('Source entity type') &&
                     err.includes(invalidType) &&
                     err.includes(relationType.relationTypeId) &&
                     err.includes('Allowed types');
            });
            
            return hasSourceError;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide clear error messages for target entity type violations', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          (relationType, invalidType) => {
            // Skip if the invalid type happens to be in the allowed list
            if (relationType.targetEntityTypes.includes(invalidType)) {
              return true;
            }

            const relation = {
              sourceEntityType: relationType.sourceEntityTypes[0],
              targetEntityType: invalidType,
              sourceId: 'source-123',
              targetId: 'target-456'
            };

            const result = validator.validate(relation, relationType);
            
            if (result.valid) {
              return false; // Should have failed
            }

            // Error message should mention:
            // 1. The invalid entity type
            // 2. The relation type ID
            // 3. The allowed types
            const hasTargetError = result.errors.some(err => {
              return err.includes('Target entity type') &&
                     err.includes(invalidType) &&
                     err.includes(relationType.relationTypeId) &&
                     err.includes('Allowed types');
            });
            
            return hasTargetError;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide clear error messages for confidence violations', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary().filter(rt => rt.supportsConfidence),
          invalidConfidenceArbitrary(),
          (relationType, invalidConfidence) => {
            const relation = {
              sourceEntityType: relationType.sourceEntityTypes[0],
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456',
              confidence: invalidConfidence
            };

            const result = validator.validate(relation, relationType);
            
            // Error message should mention:
            // 1. The confidence value
            // 2. The valid range [0, 1]
            const hasConfidenceError = result.errors.some(err => {
              return err.includes('Confidence') &&
                     err.includes('invalid') &&
                     err.includes('between 0 and 1');
            });
            
            return hasConfidenceError;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return non-empty error array for invalid relations', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          (relationType, invalidSource, invalidTarget) => {
            // Skip if either invalid type happens to be in the allowed list
            if (relationType.sourceEntityTypes.includes(invalidSource) ||
                relationType.targetEntityTypes.includes(invalidTarget)) {
              return true;
            }

            const relation = {
              sourceEntityType: invalidSource,
              targetEntityType: invalidTarget,
              sourceId: 'source-123',
              targetId: 'target-456'
            };

            const result = validator.validate(relation, relationType);
            
            // Should have errors
            return !result.valid && result.errors.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty error array for valid relations', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const relation = {
              sourceEntityType: relationType.sourceEntityTypes[0],
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456',
              confidence: relationType.supportsConfidence ? 0.8 : undefined,
              timestamp: relationType.isTemporal ? new Date() : undefined
            };

            const result = validator.validate(relation, relationType);
            
            // Should be valid with no errors
            return result.valid && result.errors.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include relation type ID in error messages', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          invalidEntityTypeArbitrary(),
          (relationType, invalidType) => {
            // Skip if the invalid type happens to be in the allowed list
            if (relationType.sourceEntityTypes.includes(invalidType)) {
              return true;
            }

            const relation = {
              sourceEntityType: invalidType,
              targetEntityType: relationType.targetEntityTypes[0],
              sourceId: 'source-123',
              targetId: 'target-456'
            };

            const result = validator.validate(relation, relationType);
            
            if (result.valid) {
              return false;
            }

            // At least one error should mention the relation type ID
            const hasRelationTypeId = result.errors.some(err => 
              err.includes(relationType.relationTypeId)
            );
            
            return hasRelationTypeId;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Additional Validation Properties', () => {
    it('should validate temporal relations consistently', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary().filter(rt => rt.isTemporal),
          fc.date().filter(d => !isNaN(d.getTime())),
          (relationType, timestamp) => {
            const isValid = validator.validateTimestamp(timestamp, relationType);
            return isValid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate directional relations consistently', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary().filter(rt => rt.isDirectional),
          fc.uuid(),
          fc.uuid(),
          (relationType, sourceId, targetId) => {
            // Different IDs should be valid
            if (sourceId !== targetId) {
              const isValid = validator.validateDirection(sourceId, targetId, relationType);
              return isValid === true;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle batch validation consistently', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          fc.array(fc.record({
            sourceEntityType: fc.constantFrom('PersonEntity', 'OrganizationEntity'),
            targetEntityType: fc.constantFrom('PersonEntity', 'LocationEntity'),
            sourceId: fc.uuid(),
            targetId: fc.uuid()
          }), { minLength: 1, maxLength: 10 }),
          (relationType, relations) => {
            const result = validator.validateBatch(relations, relationType.relationTypeId);
            
            // Total should equal valid + invalid
            return result.valid + result.invalid === relations.length &&
                   result.validations.length === relations.length;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
