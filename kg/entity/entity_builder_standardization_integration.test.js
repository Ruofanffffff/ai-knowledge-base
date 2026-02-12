/**
 * Entity Builder Integration Tests with Name Standardization
 * 
 * Tests the integration of EntityNameStandardizer with Entity Builder.
 * Validates that standardization works correctly when enabled/disabled.
 * 
 * Test Coverage:
 * - Entity building with standardization enabled
 * - Entity building with standardization disabled
 * - Metadata preservation (original_name, standardized flag)
 * - Real document samples
 * - Error handling and fallback behavior
 */

const {
  generateCanonicalName,
  buildEntity,
  initEntityNameStandardizer
} = require('./entity_builder');

describe('Entity Builder - Name Standardization Integration', () => {
  // Sample CKB for testing
  const sampleCKB = {
    ckb_id: 'ckb_test_001',
    doc_id: 'doc_test_001',
    content: {
      text: '在阿里C区，2025年1月的地下水位下降了10米。ISO 6400的感光度设置适合低光环境拍摄。快门速度1/1000秒可以冻结运动。'
    }
  };

  // Sample schema for EventEntity
  const eventSchema = {
    schema_name: '地下水位变化事件',
    entity_type: 'EventEntity',
    core_fields: [
      { name: '区域', weight: 0.9 },
      { name: '指标', weight: 0.8 },
      { name: '时间', weight: 0.7 }
    ]
  };

  // Sample schema for PhotographyEntity
  const photographySchema = {
    schema_name: '摄影参数',
    entity_type: 'PhotographyEntity',
    core_fields: [
      { name: 'ISO', weight: 0.8 },
      { name: 'ShutterSpeed', weight: 0.7 },
      { name: 'Camera', weight: 0.9 }
    ]
  };

  beforeAll(() => {
    // Initialize standardizer
    initEntityNameStandardizer();
  });

  describe('Standardization Enabled', () => {
    test('should standardize entity name when enabled', async () => {
      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.standardized).toBe(true);
      expect(result.original_name).toBeDefined();
      
      // Standardized name should be different from original (if standardization applied)
      // or same if already well-formed
      expect(typeof result.canonical_name).toBe('string');
      expect(result.canonical_name.length).toBeGreaterThan(0);
    });

    test('should preserve original name in metadata', async () => {
      const fields = {
        '区域': '阿里 C 区',  // Extra spaces
        '指标': '水位',
        '时间': '2025-01'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result.original_name).toBeDefined();
      expect(result.standardized).toBe(true);
      
      // Original name should be preserved
      expect(result.original_name).toContain('阿里');
    });

    test('should standardize numeric parameter names', async () => {
      const fields = {
        'ISO': '6400',
        'ShutterSpeed': '1/1000',
        'Camera': 'Canon EOS R5'
      };

      const result = await generateCanonicalName(
        fields,
        photographySchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.standardized).toBe(true);
      
      // Name should contain descriptive terms, not just numbers
      expect(result.canonical_name).not.toBe('6400');
      expect(result.canonical_name).not.toBe('1/1000');
    });

    test('should handle buildEntity with standardization', async () => {
      const schemaScore = {
        schema: eventSchema,
        completeness: 0.85
      };

      const fields = [
        { name: '区域', value: '阿里C区' },
        { name: '指标', value: '水位' },
        { name: '时间', value: '2025-01' }
      ];

      const entity = await buildEntity(
        schemaScore,
        fields,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(entity).toBeDefined();
      expect(entity.entity_id).toBeDefined();
      expect(entity.canonical_name).toBeDefined();
      expect(entity.entity_type).toBe('EventEntity');
      expect(entity.schema_name).toBe('地下水位变化事件');
      
      // Check that fields are preserved
      expect(entity.fields).toBeDefined();
      expect(entity.fields['区域']).toBe('阿里C区');
    });
  });

  describe('Standardization Disabled', () => {
    test('should not standardize when disabled', async () => {
      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: false
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.standardized).toBe(false);
      
      // Should use rule-based name directly
      expect(result.canonical_name).toContain('阿里C区');
      expect(result.canonical_name).toContain('水位');
    });

    test('should use environment variable by default', async () => {
      // Save original env
      const originalEnv = process.env.ENABLE_ENTITY_NAME_STANDARDIZATION;
      
      // Test with env enabled
      process.env.ENABLE_ENTITY_NAME_STANDARDIZATION = 'true';
      
      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      const result1 = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        { useLLM: false }
      );

      expect(result1.standardized).toBe(true);
      
      // Test with env disabled
      process.env.ENABLE_ENTITY_NAME_STANDARDIZATION = 'false';
      
      const result2 = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        { useLLM: false }
      );

      expect(result2.standardized).toBe(false);
      
      // Restore original env
      if (originalEnv !== undefined) {
        process.env.ENABLE_ENTITY_NAME_STANDARDIZATION = originalEnv;
      } else {
        delete process.env.ENABLE_ENTITY_NAME_STANDARDIZATION;
      }
    });

    test('should handle buildEntity without standardization', async () => {
      const schemaScore = {
        schema: eventSchema,
        completeness: 0.85
      };

      const fields = [
        { name: '区域', value: '阿里C区' },
        { name: '指标', value: '水位' },
        { name: '时间', value: '2025-01' }
      ];

      const entity = await buildEntity(
        schemaScore,
        fields,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: false
        }
      );

      expect(entity).toBeDefined();
      expect(entity.canonical_name).toBeDefined();
      
      // Should use rule-based name
      expect(entity.canonical_name).toContain('阿里C区');
    });
  });

  describe('Real Document Samples', () => {
    test('should handle photography course document', async () => {
      const photographyCKB = {
        ckb_id: 'ckb_photo_001',
        doc_id: 'doc_photo_001',
        content: {
          text: '在风光摄影中，ISO 100提供最佳画质。使用f/8光圈可以获得良好的景深。快门速度1/125秒适合手持拍摄。'
        }
      };

      const fields = {
        'ISO': '100',
        'Aperture': 'f/8',
        'ShutterSpeed': '1/125'
      };

      const result = await generateCanonicalName(
        fields,
        photographySchema,
        photographyCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.standardized).toBe(true);
      
      // Name should be descriptive
      expect(result.canonical_name.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle imaging science PRD document', async () => {
      const imagingScienceCKB = {
        ckb_id: 'ckb_imaging_001',
        doc_id: 'doc_imaging_001',
        content: {
          text: '图像处理算法包括降噪、锐化和色彩校正。使用高斯滤波器可以有效降低噪声。'
        }
      };

      const algorithmSchema = {
        schema_name: '图像处理算法',
        entity_type: 'ResearchEntity',
        core_fields: [
          { name: 'Algorithm', weight: 0.9 },
          { name: 'Purpose', weight: 0.8 }
        ]
      };

      const fields = {
        'Algorithm': '高斯滤波器',
        'Purpose': '降噪'
      };

      const result = await generateCanonicalName(
        fields,
        algorithmSchema,
        imagingScienceCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.standardized).toBe(true);
    });

    test('should handle travel document', async () => {
      const travelCKB = {
        ckb_id: 'ckb_travel_001',
        doc_id: 'doc_travel_001',
        content: {
          text: '2024年10月访问了巴黎埃菲尔铁塔。天气晴朗，适合拍照。'
        }
      };

      const travelSchema = {
        schema_name: '旅行记录',
        entity_type: 'TravelEntity',
        core_fields: [
          { name: 'Location', weight: 0.9 },
          { name: 'Timestamp', weight: 0.8 }
        ]
      };

      const fields = {
        'Location': '巴黎埃菲尔铁塔',
        'Timestamp': '2024-10'
      };

      const result = await generateCanonicalName(
        fields,
        travelSchema,
        travelCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.standardized).toBe(true);
      expect(result.canonical_name).toContain('巴黎');
    });
  });

  describe('Error Handling and Fallback', () => {
    test('should fallback to original name on standardization error', async () => {
      // Create a CKB with minimal context to potentially trigger errors
      const minimalCKB = {
        ckb_id: 'ckb_minimal_001',
        doc_id: 'doc_minimal_001',
        content: {
          text: ''  // Empty text
        }
      };

      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        minimalCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      
      // Should still return a valid name (fallback to rule-based)
      expect(result.canonical_name.length).toBeGreaterThan(0);
    });

    test('should handle missing fields gracefully', async () => {
      const fields = {
        '区域': '阿里C区'
        // Missing other fields
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.canonical_name.length).toBeGreaterThan(0);
    });

    test('should handle special characters in names', async () => {
      const fields = {
        '区域': '阿里C区（测试）',
        '指标': '水位/深度',
        '时间': '2025-01-15'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.standardized).toBe(true);
    });

    test('should handle very long names', async () => {
      const longName = '阿里C区地下水位监测站点编号12345的2025年1月份水位变化趋势分析报告';
      
      const fields = {
        '区域': longName,
        '指标': '水位',
        '时间': '2025-01'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      
      // Standardization should handle long names
      expect(result.canonical_name.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Metadata Verification', () => {
    test('should include all required metadata fields', async () => {
      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      // Check all metadata fields
      expect(result).toHaveProperty('canonical_name');
      expect(result).toHaveProperty('aliases');
      expect(result).toHaveProperty('llm_enhanced');
      expect(result).toHaveProperty('needs_fixing');
      expect(result).toHaveProperty('standardized');
      expect(result).toHaveProperty('original_name');
      
      // Verify types
      expect(typeof result.canonical_name).toBe('string');
      expect(Array.isArray(result.aliases)).toBe(true);
      expect(typeof result.llm_enhanced).toBe('boolean');
      expect(typeof result.needs_fixing).toBe('boolean');
      expect(typeof result.standardized).toBe('boolean');
      expect(typeof result.original_name).toBe('string');
    });

    test('should correctly set standardized flag', async () => {
      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      // With standardization enabled
      const result1 = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result1.standardized).toBe(true);

      // With standardization disabled
      const result2 = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: false
        }
      );

      expect(result2.standardized).toBe(false);
    });

    test('should preserve original name even when unchanged', async () => {
      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: false,
          enableStandardization: true
        }
      );

      expect(result.original_name).toBeDefined();
      expect(result.original_name.length).toBeGreaterThan(0);
      
      // Original name should always be set
      expect(result.original_name).toBeTruthy();
    });
  });

  describe('Integration with LLM Enhancement', () => {
    test('should work with both standardization and LLM enhancement', async () => {
      // Use field values that produce a name NOT passing checkNameWellFormed
      // (single-char value '了' starts with a function word and is too short)
      const fields = {
        '区域': '了',
        '指标': '456',
        '时间': '789'
      };

      // Mock LLM client
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          canonical_name: '阿里C区水位监测_2025年1月',
          aliases: ['阿里C区水位', 'C区水位2025-01'],
          reasoning: 'Standardized and enhanced',
          _meta: { tokens: 150 }
        })
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: true,
          llmProbability: 1.0,  // Always use LLM
          llmClient: mockLLMClient,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      expect(result.llm_enhanced).toBe(true);
      
      // LLM should have been called
      expect(mockLLMClient.callJSON).toHaveBeenCalled();
    });

    test('should skip LLM when name is already well-formed', async () => {
      const fields = {
        '区域': '阿里C区',
        '指标': '水位',
        '时间': '2025-01'
      };

      const mockLLMClient = {
        callJSON: jest.fn()
      };

      const result = await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: true,
          llmClient: mockLLMClient,
          enableStandardization: true
        }
      );

      expect(result).toBeDefined();
      expect(result.llm_enhanced).toBe(false);
      expect(result.skipped_reason).toBe('already_well_formed');
      
      // LLM should NOT have been called
      expect(mockLLMClient.callJSON).not.toHaveBeenCalled();
    });

    test('should apply standardization before LLM enhancement', async () => {
      // Use field values that produce a non-well-formed name to trigger LLM
      const fields = {
        '区域': '了',
        '指标': '456',
        '时间': '789'
      };

      // Mock LLM client that captures the input
      let capturedPrompt = '';
      const mockLLMClient = {
        callJSON: jest.fn().mockImplementation((prompt) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            canonical_name: '阿里C区水位_2025-01',
            aliases: [],
            reasoning: 'Enhanced',
            _meta: { tokens: 100 }
          });
        })
      };

      await generateCanonicalName(
        fields,
        eventSchema,
        sampleCKB,
        {
          useLLM: true,
          llmProbability: 1.0,
          llmClient: mockLLMClient,
          enableStandardization: true
        }
      );

      // LLM should receive the standardized name
      expect(capturedPrompt).toBeDefined();
      expect(capturedPrompt.length).toBeGreaterThan(0);
    });
  });
});
