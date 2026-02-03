/**
 * Dynamic Mapping Strategy Adjuster - Unit Tests
 * 
 * Tests dynamic strategy adjustment functionality.
 * Validates: Requirement 18.17
 */

const {
  adjustStrategy,
  recordStrategyAdjustment,
  getStrategyRecommendation,
  getStrategyStatistics,
  compareStrategies,
  validateStrategy,
  DEFAULT_STRATEGY,
  SCENE_STRATEGIES,
  CONTEXT_PATTERNS
} = require('./strategy_adjuster');

describe('Dynamic Mapping Strategy Adjuster - Task 7.13.5', () => {
  describe('adjustStrategy', () => {
    test('should return default strategy when no schema or document provided', () => {
      const strategy = adjustStrategy(null, null);
      
      expect(strategy).toBeDefined();
      expect(strategy.useLLM).toBe(DEFAULT_STRATEGY.useLLM);
      expect(strategy.llmProbability).toBe(DEFAULT_STRATEGY.llmProbability);
      expect(strategy.adjustments).toEqual([]);
    });
    
    test('should adjust strategy based on schema scene', () => {
      const schema = {
        schema_name: '地下水位变化事件',
        scene: '科研'
      };
      
      const strategy = adjustStrategy(schema, null);
      
      expect(strategy).toBeDefined();
      expect(strategy.llmProbability).toBe(0.7);  // Scientific research uses 0.7
      expect(strategy.adjustments.length).toBe(1);
      expect(strategy.adjustments[0].type).toBe('scene');
      expect(strategy.adjustments[0].scene).toBe('科研');
    });
    
    test('should adjust strategy for government affairs scene', () => {
      const schema = {
        schema_name: 'Test Schema',
        scene: '政务'
      };
      
      const strategy = adjustStrategy(schema, null);
      
      expect(strategy.llmProbability).toBe(0.6);
      expect(strategy.adjustments[0].scene).toBe('政务');
    });
    
    test('should adjust strategy for personal life scene', () => {
      const schema = {
        schema_name: 'Test Schema',
        scene: '个人生活'
      };
      
      const strategy = adjustStrategy(schema, null);
      
      expect(strategy.llmProbability).toBe(0.3);  // Lower for speed
      expect(strategy.adjustments[0].scene).toBe('个人生活');
    });
    
    test('should adjust strategy based on technical context', () => {
      const document = {
        content: '这是一份实验数据分析报告，包含多个测试指标和研究参数'
      };
      
      const strategy = adjustStrategy(null, document);
      
      expect(strategy).toBeDefined();
      expect(strategy.llmProbability).toBe(0.7);  // Technical context
      expect(strategy.adjustments.length).toBe(1);
      expect(strategy.adjustments[0].type).toBe('context');
      expect(strategy.adjustments[0].pattern).toBe('technical');
    });
    
    test('should adjust strategy based on casual context', () => {
      const document = {
        content: '今天的日常生活记录，和朋友聊天，记录一些个人想法'
      };
      
      const strategy = adjustStrategy(null, document);
      
      expect(strategy.llmProbability).toBe(0.3);  // Casual context
      expect(strategy.adjustments[0].pattern).toBe('casual');
    });
    
    test('should adjust strategy based on business context', () => {
      const document = {
        content: '项目会议记录，讨论商务合同和客户需求'
      };
      
      const strategy = adjustStrategy(null, document);
      
      expect(strategy.llmProbability).toBe(0.6);  // Business context
      expect(strategy.adjustments[0].pattern).toBe('business');
    });
    
    test('should adjust strategy based on urgent context', () => {
      const document = {
        content: '紧急通知：请立即处理重要事项'
      };
      
      const strategy = adjustStrategy(null, document);
      
      expect(strategy.llmProbability).toBe(0.2);  // Urgent context prioritizes speed
      expect(strategy.adjustments[0].pattern).toBe('urgent');
    });
    
    test('should combine scene and context adjustments', () => {
      const schema = {
        schema_name: 'Test Schema',
        scene: '科研'
      };
      
      const document = {
        content: '实验数据分析报告'
      };
      
      const strategy = adjustStrategy(schema, document);
      
      expect(strategy.adjustments.length).toBe(2);
      expect(strategy.adjustments[0].type).toBe('scene');
      expect(strategy.adjustments[1].type).toBe('context');
    });
    
    test('should use custom base strategy', () => {
      const baseStrategy = {
        useLLM: false,
        llmProbability: 0.1,
        cleanValues: false,
        useCache: false
      };
      
      const strategy = adjustStrategy(null, null, baseStrategy);
      
      expect(strategy.useLLM).toBe(false);
      expect(strategy.llmProbability).toBe(0.1);
    });
    
    test('should not adjust for unknown scene', () => {
      const schema = {
        schema_name: 'Test Schema',
        scene: 'UnknownScene'
      };
      
      const strategy = adjustStrategy(schema, null);
      
      expect(strategy.adjustments.length).toBe(0);
      expect(strategy.llmProbability).toBe(DEFAULT_STRATEGY.llmProbability);
    });
    
    test('should require at least 2 keyword matches for context adjustment', () => {
      const document = {
        content: '这是一份报告'  // Only 1 technical keyword
      };
      
      const strategy = adjustStrategy(null, document);
      
      expect(strategy.adjustments.length).toBe(0);
    });
  });
  
  describe('recordStrategyAdjustment', () => {
    test('should record strategy adjustment log', async () => {
      const log = {
        schemaName: '地下水位变化事件',
        documentId: 'doc123',
        baseStrategy: { llmProbability: 0.5 },
        adjustedStrategy: { llmProbability: 0.7 },
        adjustments: [
          { type: 'scene', scene: '科研', reason: 'Scientific research requires high precision' }
        ]
      };
      
      const result = await recordStrategyAdjustment(log);
      
      expect(result).toBeDefined();
      expect(result.schemaName).toBe('地下水位变化事件');
      expect(result.documentId).toBe('doc123');
      expect(result.timestamp).toBeDefined();
    });
    
    test('should throw error for missing schemaName', async () => {
      await expect(recordStrategyAdjustment({})).rejects.toThrow();
      await expect(recordStrategyAdjustment(null)).rejects.toThrow();
    });
  });
  
  describe('getStrategyRecommendation', () => {
    test('should recommend strategy based on scene', async () => {
      const recommendation = await getStrategyRecommendation({
        schemaName: '地下水位变化事件',
        scene: '科研'
      });
      
      expect(recommendation).toBeDefined();
      expect(recommendation.recommended).toBeDefined();
      expect(recommendation.recommended.llmProbability).toBe(0.7);
      expect(recommendation.reason).toContain('Scientific research');
      expect(recommendation.confidence).toBe(0.9);
    });
    
    test('should recommend strategy based on context', async () => {
      const recommendation = await getStrategyRecommendation({
        context: '实验数据分析报告，包含测试指标'
      });
      
      expect(recommendation).toBeDefined();
      expect(recommendation.recommended.llmProbability).toBe(0.7);
      expect(recommendation.confidence).toBe(0.9);
    });
    
    test('should return default strategy when no options provided', async () => {
      const recommendation = await getStrategyRecommendation();
      
      expect(recommendation).toBeDefined();
      expect(recommendation.recommended.llmProbability).toBe(DEFAULT_STRATEGY.llmProbability);
      expect(recommendation.confidence).toBe(0.5);
    });
    
    test('should combine scene and context in recommendation', async () => {
      const recommendation = await getStrategyRecommendation({
        scene: '科研',
        context: '实验数据分析'
      });
      
      expect(recommendation.adjustments.length).toBe(2);
    });
  });
  
  describe('getStrategyStatistics', () => {
    test('should return strategy statistics', () => {
      const stats = getStrategyStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.defaultStrategy).toEqual(DEFAULT_STRATEGY);
      expect(stats.sceneStrategies).toBeDefined();
      expect(Array.isArray(stats.sceneStrategies)).toBe(true);
      expect(stats.contextPatterns).toBeDefined();
      expect(Array.isArray(stats.contextPatterns)).toBe(true);
    });
    
    test('should include all scene strategies', () => {
      const stats = getStrategyStatistics();
      
      const sceneNames = stats.sceneStrategies.map(s => s.scene);
      expect(sceneNames).toContain('科研');
      expect(sceneNames).toContain('政务');
      expect(sceneNames).toContain('个人生活');
      expect(sceneNames).toContain('旅行');
      expect(sceneNames).toContain('摄影');
      expect(sceneNames).toContain('工作');
    });
    
    test('should include all context patterns', () => {
      const stats = getStrategyStatistics();
      
      const patternNames = stats.contextPatterns.map(p => p.pattern);
      expect(patternNames).toContain('technical');
      expect(patternNames).toContain('casual');
      expect(patternNames).toContain('business');
      expect(patternNames).toContain('urgent');
    });
  });
  
  describe('compareStrategies', () => {
    test('should identify differences between strategies', () => {
      const strategy1 = {
        useLLM: true,
        llmProbability: 0.5,
        cleanValues: true
      };
      
      const strategy2 = {
        useLLM: true,
        llmProbability: 0.7,
        cleanValues: false
      };
      
      const comparison = compareStrategies(strategy1, strategy2);
      
      expect(comparison.hasDifferences).toBe(true);
      expect(comparison.differences.llmProbability).toEqual({
        before: 0.5,
        after: 0.7
      });
      expect(comparison.differences.cleanValues).toEqual({
        before: true,
        after: false
      });
    });
    
    test('should return no differences for identical strategies', () => {
      const strategy1 = {
        useLLM: true,
        llmProbability: 0.5
      };
      
      const strategy2 = {
        useLLM: true,
        llmProbability: 0.5
      };
      
      const comparison = compareStrategies(strategy1, strategy2);
      
      expect(comparison.hasDifferences).toBe(false);
      expect(Object.keys(comparison.differences).length).toBe(0);
    });
  });
  
  describe('validateStrategy', () => {
    test('should validate correct strategy', () => {
      const strategy = {
        useLLM: true,
        llmProbability: 0.5,
        cleanValues: true,
        useCache: true
      };
      
      const validation = validateStrategy(strategy);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
    
    test('should reject invalid useLLM', () => {
      const strategy = {
        useLLM: 'yes',  // Should be boolean
        llmProbability: 0.5,
        cleanValues: true,
        useCache: true
      };
      
      const validation = validateStrategy(strategy);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('useLLM must be a boolean');
    });
    
    test('should reject invalid llmProbability', () => {
      const strategy = {
        useLLM: true,
        llmProbability: 1.5,  // Should be between 0 and 1
        cleanValues: true,
        useCache: true
      };
      
      const validation = validateStrategy(strategy);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('llmProbability must be a number between 0 and 1');
    });
    
    test('should reject negative llmProbability', () => {
      const strategy = {
        useLLM: true,
        llmProbability: -0.1,
        cleanValues: true,
        useCache: true
      };
      
      const validation = validateStrategy(strategy);
      
      expect(validation.valid).toBe(false);
    });
    
    test('should reject invalid cleanValues', () => {
      const strategy = {
        useLLM: true,
        llmProbability: 0.5,
        cleanValues: 'yes',  // Should be boolean
        useCache: true
      };
      
      const validation = validateStrategy(strategy);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('cleanValues must be a boolean');
    });
  });
  
  describe('Constants', () => {
    test('should have valid DEFAULT_STRATEGY', () => {
      expect(DEFAULT_STRATEGY).toBeDefined();
      expect(DEFAULT_STRATEGY.useLLM).toBe(true);
      expect(DEFAULT_STRATEGY.llmProbability).toBe(0.5);
      expect(DEFAULT_STRATEGY.cleanValues).toBe(true);
      expect(DEFAULT_STRATEGY.useCache).toBe(true);
    });
    
    test('should have valid SCENE_STRATEGIES', () => {
      expect(SCENE_STRATEGIES).toBeDefined();
      expect(Object.keys(SCENE_STRATEGIES).length).toBeGreaterThan(0);
      
      // Verify each scene strategy has required fields
      for (const [scene, strategy] of Object.entries(SCENE_STRATEGIES)) {
        expect(strategy.llmProbability).toBeGreaterThanOrEqual(0);
        expect(strategy.llmProbability).toBeLessThanOrEqual(1);
        expect(strategy.reason).toBeDefined();
      }
    });
    
    test('should have valid CONTEXT_PATTERNS', () => {
      expect(CONTEXT_PATTERNS).toBeDefined();
      expect(Object.keys(CONTEXT_PATTERNS).length).toBeGreaterThan(0);
      
      // Verify each context pattern has required fields
      for (const [pattern, config] of Object.entries(CONTEXT_PATTERNS)) {
        expect(Array.isArray(config.keywords)).toBe(true);
        expect(config.keywords.length).toBeGreaterThan(0);
        expect(config.adjustment).toBeDefined();
        expect(config.adjustment.llmProbability).toBeGreaterThanOrEqual(0);
        expect(config.adjustment.llmProbability).toBeLessThanOrEqual(1);
      }
    });
  });
});
