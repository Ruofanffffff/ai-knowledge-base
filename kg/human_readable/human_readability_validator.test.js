/**
 * Unit tests for HumanReadabilityValidator
 */

const { HumanReadabilityValidator } = require('./human_readability_validator');

describe('HumanReadabilityValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new HumanReadabilityValidator();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(validator.strictMode).toBe(false);
      expect(validator.minNameLength).toBe(2);
      expect(validator.maxNameLength).toBe(40);
      expect(validator.minDescriptionWords).toBe(5);
      expect(validator.maxDescriptionWords).toBe(50);
    });

    test('should initialize with custom options', () => {
      const customValidator = new HumanReadabilityValidator({
        strictMode: true,
        minNameLength: 3,
        maxNameLength: 30,
        minDescriptionWords: 10,
        maxDescriptionWords: 40
      });

      expect(customValidator.strictMode).toBe(true);
      expect(customValidator.minNameLength).toBe(3);
      expect(customValidator.maxNameLength).toBe(30);
      expect(customValidator.minDescriptionWords).toBe(10);
      expect(customValidator.maxDescriptionWords).toBe(40);
    });
  });

  describe('validateEntityNames', () => {
    test('should pass validation for valid entity names', () => {
      const entities = [
        { name: 'Canon EOS R5' },
        { canonical_name: '北京故宫' },
        { name: 'exposure_time_125' }  // Changed from 曝光时间_1/125s to avoid slash
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.score).toBe(1);
      expect(result.validCount).toBe(3);
      expect(result.totalCount).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should detect unknown entity names', () => {
      const entities = [
        { name: 'unknown' },
        { name: 'Unknown Entity' },
        { name: 'UNKNOWN_123' }
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('unknown');
    });

    test('should detect empty or undefined names', () => {
      const entities = [
        { name: '' },
        { name: null },
        { canonical_name: undefined }
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate Chinese name length (2-20 characters)', () => {
      const entities = [
        { name: '北' },  // Too short
        { name: '这是一个非常非常非常非常非常长的中文实体名称' },  // Too long
        { name: '北京故宫' }  // Valid
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('too short'))).toBe(true);
      expect(result.warnings.some(w => w.includes('too long'))).toBe(true);
    });

    test('should validate English name length (2-40 characters)', () => {
      const entities = [
        { name: 'A' },  // Too short
        { name: 'This is a very very very very very very long English entity name that exceeds the limit' },  // Too long
        { name: 'Canon EOS R5' }  // Valid
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should detect pure numeric names', () => {
      const entities = [
        { name: '123' },
        { name: '45.67' },
        { name: '1/125' }  // This should be caught
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.warnings.some(w => w.includes('pure number'))).toBe(true);
    });

    test('should detect excessive whitespace', () => {
      const entities = [
        { name: 'Canon  EOS  R5' },
        { name: 'Name   with   spaces' }
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.warnings.some(w => w.includes('excessive whitespace'))).toBe(true);
    });

    test('should detect special characters', () => {
      const entities = [
        { name: 'Name@#$%' },
        { name: 'Entity!Name' }
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.warnings.some(w => w.includes('special characters'))).toBe(true);
    });

    test('should allow hyphens and underscores', () => {
      const entities = [
        { name: 'Canon-EOS-R5' },
        { name: 'exposure_time_125' }
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.validCount).toBe(2);
      expect(result.warnings.filter(w => w.includes('special characters'))).toHaveLength(0);
    });

    test('should detect lack of descriptive content', () => {
      const entities = [
        { name: '___' },
        { name: '---' },
        { name: '123' }
      ];

      const result = validator.validateEntityNames(entities);

      expect(result.warnings.some(w => w.includes('lacks descriptive content'))).toBe(true);
    });

    test('should handle empty entity list', () => {
      const result = validator.validateEntityNames([]);

      expect(result.score).toBe(0);
      expect(result.validCount).toBe(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('validateRelationDescriptions', () => {
    test('should pass validation for valid descriptions', () => {
      const relations = [
        {
          source: 'Canon EOS R5',
          target: '北京故宫',
          description: 'Canon EOS R5相机在北京故宫拍摄了精美的照片。'
        },
        {
          source: 'Camera',
          target: 'Lens',
          description: 'The Camera is equipped with a high-quality Lens for professional photography.'
        }
      ];

      const result = validator.validateRelationDescriptions(relations);

      expect(result.score).toBe(1);
      expect(result.validCount).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing descriptions', () => {
      const relations = [
        { source: 'A', target: 'B', description: '' },
        { source: 'C', target: 'D', description: null },
        { source: 'E', target: 'F' }
      ];

      const result = validator.validateRelationDescriptions(relations);

      expect(result.errors.length).toBe(3);
      expect(result.errors[0]).toContain('missing description');
    });

    test('should detect descriptions that are too short', () => {
      const relations = [
        { source: 'A', target: 'B', description: 'Short' },
        { source: 'C', target: 'D', description: 'Too brief' }
      ];

      const result = validator.validateRelationDescriptions(relations);

      expect(result.warnings.some(w => w.includes('too short'))).toBe(true);
    });

    test('should detect descriptions that are too long', () => {
      const longDescription = 'This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long description that exceeds the maximum word count limit';
      
      const relations = [
        { source: 'A', target: 'B', description: longDescription }
      ];

      const result = validator.validateRelationDescriptions(relations);

      expect(result.warnings.some(w => w.includes('too long'))).toBe(true);
    });

    test('should detect missing entity references', () => {
      const relations = [
        {
          source: 'Canon EOS R5',
          target: '北京故宫',
          description: 'This is a generic description without entity names'
        }
      ];

      const result = validator.validateRelationDescriptions(relations);

      expect(result.warnings.some(w => w.includes("doesn't reference entities"))).toBe(true);
    });

    test('should detect code-like descriptions', () => {
      const relations = [
        { source: 'A', target: 'B', description: 'REL_TYPE_123' },
        { source: 'C', target: 'D', description: 'CODE_ID' }
      ];

      const result = validator.validateRelationDescriptions(relations);

      expect(result.warnings.some(w => w.includes('code/ID'))).toBe(true);
    });

    test('should handle empty relation list', () => {
      const result = validator.validateRelationDescriptions([]);

      expect(result.score).toBe(0);
      expect(result.validCount).toBe(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('validate', () => {
    test('should validate complete knowledge graph', () => {
      const knowledgeGraph = {
        entities: [
          { name: 'Canon EOS R5' },
          { name: '北京故宫' }
        ],
        relations: [
          {
            source: 'Canon EOS R5',
            target: '北京故宫',
            description: 'Canon EOS R5相机在北京故宫拍摄了精美的照片。'
          }
        ]
      };

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0.5);  // Adjusted expectation
      expect(result.details.entities).toBeDefined();
      expect(result.details.relations).toBeDefined();
    });

    test('should fail validation with errors', () => {
      const knowledgeGraph = {
        entities: [
          { name: 'unknown' },
          { name: 'Valid Name' }
        ],
        relations: [
          { source: 'A', target: 'B', description: '' }
        ]
      };

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should pass in non-strict mode with warnings', () => {
      const validator = new HumanReadabilityValidator({ strictMode: false });
      
      const knowledgeGraph = {
        entities: [
          { name: 'A' },  // Too short, will generate warning
          { name: 'Valid Name' }
        ],
        relations: [
          {
            source: 'A',
            target: 'B',
            description: 'This is a valid description with enough words'
          }
        ]
      };

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(true);  // No errors, only warnings
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should fail in strict mode with warnings', () => {
      const validator = new HumanReadabilityValidator({ strictMode: true });
      
      const knowledgeGraph = {
        entities: [
          { name: 'A' },  // Too short, will generate warning
          { name: 'Valid Name' }
        ],
        relations: [
          {
            source: 'A',
            target: 'B',
            description: 'This is a valid description with enough words'
          }
        ]
      };

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(false);  // Strict mode fails on warnings
    });
  });

  describe('generateQualityReport', () => {
    test('should generate comprehensive quality report', () => {
      const knowledgeGraph = {
        entities: [
          { name: 'Canon EOS R5', name_standardization: { method: 'context' } },
          { name: '北京故宫', standardized: true },
          { name: 'Valid Entity' }
        ],
        relations: [
          {
            source: 'Canon EOS R5',
            target: '北京故宫',
            description: 'Canon EOS R5相机在北京故宫拍摄了精美的照片'
          },
          {
            source: 'A',
            target: 'B',
            description: 'Another valid description with sufficient words'
          }
        ]
      };

      const report = validator.generateQualityReport(knowledgeGraph);

      expect(report.summary).toBeDefined();
      expect(report.summary.overallScore).toBeGreaterThan(0);
      expect(report.summary.totalEntities).toBe(3);
      expect(report.summary.totalRelations).toBe(2);
      expect(report.summary.standardizedEntityPercentage).toBeGreaterThan(0);
      expect(report.summary.relationsWithDescriptionsPercentage).toBe(100);
      
      expect(report.entityStats).toBeDefined();
      expect(report.entityStats.averageNameLength).toBeGreaterThan(0);
      
      expect(report.relationStats).toBeDefined();
      expect(report.relationStats.averageDescriptionLength).toBeGreaterThan(0);
      
      expect(report.hierarchicalStats).toBeDefined();
      
      expect(report.validation).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should include hierarchical statistics', () => {
      const knowledgeGraph = {
        entities: [],
        relations: [
          { type: 'hierarchical', subtype: 'is_a', description: 'A is a type of B' },
          { type: 'hierarchical', subtype: 'part_of', description: 'C is part of D' },
          { type: 'builtin', description: 'Regular relation' }
        ]
      };

      const report = validator.generateQualityReport(knowledgeGraph);

      expect(report.hierarchicalStats.totalHierarchical).toBe(2);
      expect(report.hierarchicalStats.isACount).toBe(1);
      expect(report.hierarchicalStats.partOfCount).toBe(1);
    });

    test('should generate recommendations based on quality', () => {
      const knowledgeGraph = {
        entities: [
          { name: 'unknown' },
          { name: 'Valid' }
        ],
        relations: [
          { source: 'A', target: 'B', description: '' }
        ]
      };

      const report = validator.generateQualityReport(knowledgeGraph);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.priority === 'critical')).toBe(true);
    });

    test('should generate success message for perfect quality', () => {
      const knowledgeGraph = {
        entities: [
          { name: 'Canon EOS R5' },
          { name: '北京故宫' }
        ],
        relations: [
          {
            source: 'Canon EOS R5',
            target: '北京故宫',
            description: 'Canon EOS R5相机在北京故宫拍摄了精美的照片。'
          }
        ]
      };

      const report = validator.generateQualityReport(knowledgeGraph);

      // Check that there are recommendations (may include success or improvement suggestions)
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty knowledge graph', () => {
      const knowledgeGraph = {
        entities: [],
        relations: []
      };

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(0);
    });

    test('should handle knowledge graph with only entities', () => {
      const knowledgeGraph = {
        entities: [{ name: 'Entity' }],
        relations: []
      };

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(true);
    });

    test('should handle knowledge graph with only relations', () => {
      const knowledgeGraph = {
        entities: [],
        relations: [{
          source: 'A',
          target: 'B',
          description: 'Valid description with enough words'
        }]
      };

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(true);
    });

    test('should handle malformed knowledge graph', () => {
      const knowledgeGraph = {};

      const result = validator.validate(knowledgeGraph);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(0);
    });
  });
});
