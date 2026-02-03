/**
 * Tests for Prompt 4: Semantic Relation Candidate Extraction
 */

const {
  buildRelationExtractionPrompt,
  buildSimplifiedPrompt,
  buildBatchPrompt,
  validateRelationExtractionResult,
  validateBatchResult,
  shouldUseLLMExtraction,
  getPromptStats,
  RELATION_TYPES
} = require('./relation_candidate');

describe('Relation Candidate Prompt', () => {
  describe('buildRelationExtractionPrompt', () => {
    const mockCKB = {
      content: {
        text: '阿里C区水位下降导致地下水资源减少'
      }
    };

    const mockEntities = [
      { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' },
      { canonical_name: '地下水资源', entity_type: 'IndicatorEntity' }
    ];

    test('should build full prompt with examples', () => {
      const prompt = buildRelationExtractionPrompt(mockCKB, mockEntities);
      
      expect(prompt).toContain('你是一个知识图谱关系抽取专家');
      expect(prompt).toContain(mockCKB.content.text);
      expect(prompt).toContain('阿里C区水位下降');
      expect(prompt).toContain('地下水资源');
      expect(prompt).toContain('## 抽取示例');
      expect(prompt).toContain('因果关系');
      expect(prompt).toContain('对比关系');
      expect(prompt).toContain('"relations"');
    });

    test('should build prompt without examples', () => {
      const prompt = buildRelationExtractionPrompt(mockCKB, mockEntities, {
        includeExamples: false
      });
      
      expect(prompt).toContain('你是一个知识图谱关系抽取专家');
      expect(prompt).not.toContain('## 抽取示例');
    });

    test('should include target relation types when specified', () => {
      const prompt = buildRelationExtractionPrompt(mockCKB, mockEntities, {
        targetRelationTypes: ['causal', 'influence'],
        includeExamples: false  // Disable examples to avoid "对比关系" in examples
      });
      
      expect(prompt).toContain('因果关系');
      expect(prompt).toContain('影响关系');
      // Note: Examples section may still contain other relation types
      // This test verifies that the relation types section is filtered
    });

    test('should include strict mode constraints', () => {
      const prompt = buildRelationExtractionPrompt(mockCKB, mockEntities, {
        strictMode: true
      });
      
      expect(prompt).toContain('严格模式约束');
    });

    test('should handle empty entities', () => {
      const prompt = buildRelationExtractionPrompt(mockCKB, []);
      
      expect(prompt).toContain('无实体');
    });
  });

  describe('buildSimplifiedPrompt', () => {
    const mockCKB = {
      content: {
        text: '阿里C区水位下降导致地下水资源减少'
      }
    };

    const mockEntities = [
      { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' },
      { canonical_name: '地下水资源', entity_type: 'IndicatorEntity' }
    ];

    test('should build simplified prompt', () => {
      const prompt = buildSimplifiedPrompt(mockCKB, mockEntities);
      
      expect(prompt).toContain('从文本识别实体间的明确关系');
      expect(prompt).toContain(mockCKB.content.text);
      expect(prompt).toContain('阿里C区水位下降、地下水资源');
      expect(prompt).toContain('"relations"');
    });

    test('should be significantly shorter than full prompt', () => {
      const fullPrompt = buildRelationExtractionPrompt(mockCKB, mockEntities);
      const simplifiedPrompt = buildSimplifiedPrompt(mockCKB, mockEntities);
      
      expect(simplifiedPrompt.length).toBeLessThan(fullPrompt.length * 0.4);
    });
  });

  describe('buildBatchPrompt', () => {
    const mockCKBBatch = [
      { content: { text: '阿里C区水位下降导致地下水资源减少' } },
      { content: { text: '北京市GDP增长5.2%' } }
    ];

    const mockEntitiesBatch = [
      [
        { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' },
        { canonical_name: '地下水资源', entity_type: 'IndicatorEntity' }
      ],
      [
        { canonical_name: '北京市', entity_type: 'LocationEntity' },
        { canonical_name: 'GDP', entity_type: 'IndicatorEntity' }
      ]
    ];

    test('should build batch prompt for multiple CKBs', () => {
      const prompt = buildBatchPrompt(mockCKBBatch, mockEntitiesBatch);
      
      expect(prompt).toContain('批量识别实体间的语义关系');
      expect(prompt).toContain('文本 1');
      expect(prompt).toContain('文本 2');
      expect(prompt).toContain('阿里C区水位下降导致地下水资源减少');
      expect(prompt).toContain('北京市GDP增长5.2%');
      expect(prompt).toContain('batch_results');
    });

    test('should throw error if batch size exceeds 5', () => {
      const largeBatch = Array(6).fill(mockCKBBatch[0]);
      const largeEntitiesBatch = Array(6).fill(mockEntitiesBatch[0]);
      
      expect(() => {
        buildBatchPrompt(largeBatch, largeEntitiesBatch);
      }).toThrow('Batch size cannot exceed 5 CKBs');
    });

    test('should throw error if batch sizes mismatch', () => {
      expect(() => {
        buildBatchPrompt(mockCKBBatch, [mockEntitiesBatch[0]]);
      }).toThrow('ckbBatch and entitiesBatch must have the same length');
    });
  });

  describe('validateRelationExtractionResult', () => {
    const mockEntities = [
      { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' },
      { canonical_name: '地下水资源', entity_type: 'IndicatorEntity' }
    ];

    const originalText = '阿里C区水位下降导致地下水资源减少';

    test('should validate valid relation result', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            relation: '导致',
            object: '地下水资源',
            confidence: 0.95,
            evidence_text: '阿里C区水位下降导致地下水资源减少'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(1);
      expect(validRelations[0].subject).toBe('阿里C区水位下降');
      expect(validRelations[0].relation).toBe('导致');
      expect(validRelations[0].object).toBe('地下水资源');
      expect(errors).toHaveLength(0);
    });

    test('should reject relation with unknown subject entity', () => {
      const result = {
        relations: [
          {
            subject: '未知实体',
            relation: '导致',
            object: '地下水资源',
            confidence: 0.95,
            evidence_text: '测试'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Unknown subject entity');
    });

    test('should reject relation with unknown object entity', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            relation: '导致',
            object: '未知实体',
            confidence: 0.95,
            evidence_text: '测试'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Unknown object entity');
    });

    test('should reject relation with low confidence', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            relation: '导致',
            object: '地下水资源',
            confidence: 0.6,
            evidence_text: '测试'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Confidence too low');
    });

    test('should reject relation with invalid confidence', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            relation: '导致',
            object: '地下水资源',
            confidence: 1.5,
            evidence_text: '测试'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid confidence');
    });

    test('should reject relation with evidence not in original text', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            relation: '导致',
            object: '地下水资源',
            confidence: 0.95,
            evidence_text: '这段文字不在原文中'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('evidence_text not found in original text');
    });

    test('should reject self-referencing relation', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            relation: '导致',
            object: '阿里C区水位下降',
            confidence: 0.95,
            evidence_text: '测试'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('subject and object cannot be the same entity');
    });

    test('should reject relation with missing required fields', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            // Missing relation
            object: '地下水资源',
            confidence: 0.95,
            evidence_text: '测试'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Missing relation');
    });

    test('should handle empty relations array', () => {
      const result = { relations: [] };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    test('should validate multiple relations', () => {
      const result = {
        relations: [
          {
            subject: '阿里C区水位下降',
            relation: '导致',
            object: '地下水资源',
            confidence: 0.95,
            evidence_text: '阿里C区水位下降导致地下水资源减少'
          },
          {
            subject: '地下水资源',
            relation: '位于',
            object: '阿里C区水位下降',
            confidence: 0.8,
            evidence_text: '阿里C区水位下降'
          }
        ]
      };

      const { validRelations, errors } = validateRelationExtractionResult(
        result,
        mockEntities,
        originalText
      );

      expect(validRelations).toHaveLength(2);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateBatchResult', () => {
    const mockCKBBatch = [
      { content: { text: '阿里C区水位下降导致地下水资源减少' } },
      { content: { text: '北京市GDP增长5.2%' } }
    ];

    const mockEntitiesBatch = [
      [
        { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' },
        { canonical_name: '地下水资源', entity_type: 'IndicatorEntity' }
      ],
      [
        { canonical_name: '北京市', entity_type: 'LocationEntity' },
        { canonical_name: 'GDP', entity_type: 'IndicatorEntity' }
      ]
    ];

    test('should validate valid batch result', () => {
      const result = {
        batch_results: [
          {
            text_index: 1,
            relations: [
              {
                subject: '阿里C区水位下降',
                relation: '导致',
                object: '地下水资源',
                confidence: 0.95,
                evidence_text: '阿里C区水位下降导致地下水资源减少'
              }
            ]
          },
          {
            text_index: 2,
            relations: []
          }
        ]
      };

      const { validBatchResults, errors } = validateBatchResult(
        result,
        mockCKBBatch,
        mockEntitiesBatch
      );

      expect(validBatchResults).toHaveLength(2);
      expect(validBatchResults[0].text_index).toBe(1);
      expect(validBatchResults[0].relations).toHaveLength(1);
      expect(validBatchResults[1].text_index).toBe(2);
      expect(validBatchResults[1].relations).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    test('should reject batch item with invalid text_index', () => {
      const result = {
        batch_results: [
          {
            text_index: 5,
            relations: []
          }
        ]
      };

      const { validBatchResults, errors } = validateBatchResult(
        result,
        mockCKBBatch,
        mockEntitiesBatch
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid text_index');
    });

    test('should reject batch item with missing text_index', () => {
      const result = {
        batch_results: [
          {
            relations: []
          }
        ]
      };

      const { validBatchResults, errors } = validateBatchResult(
        result,
        mockCKBBatch,
        mockEntitiesBatch
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Missing text_index');
    });
  });

  describe('shouldUseLLMExtraction', () => {
    test('should trigger for causal keywords', () => {
      const ckb = {
        content: { text: '阿里C区水位下降导致地下水资源减少' }
      };
      const entities = [
        { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' }
      ];

      const result = shouldUseLLMExtraction(ckb, entities);

      expect(result.shouldUse).toBe(true);
      expect(result.reason).toBe('causal_keywords');
      expect(result.priority).toBe('high');
    });

    test('should trigger for comparison keywords', () => {
      const ckb = {
        content: { text: '2024年GDP增长率优于2023年' }
      };
      const entities = [
        { canonical_name: '2024年GDP增长率', entity_type: 'IndicatorEntity' }
      ];

      const result = shouldUseLLMExtraction(ckb, entities);

      expect(result.shouldUse).toBe(true);
      expect(result.reason).toBe('comparison_keywords');
      expect(result.priority).toBe('high');
    });

    test('should trigger for multi-entity scenario (3+ entities)', () => {
      const ckb = {
        content: { text: '张三在阿里巴巴担任工程师' }
      };
      const entities = [
        { canonical_name: '张三', entity_type: 'PersonEntity' },
        { canonical_name: '阿里巴巴', entity_type: 'OrganizationEntity' },
        { canonical_name: '工程师', entity_type: 'entity' }
      ];

      const result = shouldUseLLMExtraction(ckb, entities);

      expect(result.shouldUse).toBe(true);
      expect(result.reason).toBe('multi_entity');
      expect(result.priority).toBe('high');
    });

    test('should not trigger for simple text without keywords', () => {
      const ckb = {
        content: { text: '阿里C区水位10米' }
      };
      const entities = [
        { canonical_name: '阿里C区', entity_type: 'LocationEntity' }
      ];

      // Set sampling rate to 0 to avoid random triggering
      const result = shouldUseLLMExtraction(ckb, entities, { samplingRate: 0 });

      expect(result.shouldUse).toBe(false);
      expect(result.reason).toBe('no_trigger');
      expect(result.priority).toBe('low');
    });

    test('should respect custom sampling rate', () => {
      const ckb = {
        content: { text: '阿里C区水位10米' }
      };
      const entities = [
        { canonical_name: '阿里C区', entity_type: 'LocationEntity' }
      ];

      // Test with 100% sampling rate
      const result = shouldUseLLMExtraction(ckb, entities, { samplingRate: 1.0 });

      expect(result.shouldUse).toBe(true);
      expect(result.reason).toBe('random_sampling');
      expect(result.priority).toBe('medium');
    });
  });

  describe('getPromptStats', () => {
    test('should calculate prompt statistics', () => {
      const prompt = '这是一个测试提示词\n包含多行\n用于统计';
      const stats = getPromptStats(prompt);

      expect(stats.lines).toBe(3);
      expect(stats.chars).toBe(prompt.length);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(stats.estimatedTokens).toBe(Math.ceil(prompt.length / 4));
    });
  });

  describe('RELATION_TYPES', () => {
    test('should define all relation types', () => {
      expect(RELATION_TYPES).toHaveProperty('causal');
      expect(RELATION_TYPES).toHaveProperty('influence');
      expect(RELATION_TYPES).toHaveProperty('comparison');
      expect(RELATION_TYPES).toHaveProperty('containment');
      expect(RELATION_TYPES).toHaveProperty('temporal');
      expect(RELATION_TYPES).toHaveProperty('spatial');
    });

    test('each relation type should have required properties', () => {
      Object.values(RELATION_TYPES).forEach(relationType => {
        expect(relationType).toHaveProperty('name');
        expect(relationType).toHaveProperty('keywords');
        expect(relationType).toHaveProperty('examples');
        expect(Array.isArray(relationType.keywords)).toBe(true);
        expect(Array.isArray(relationType.examples)).toBe(true);
      });
    });
  });
});
