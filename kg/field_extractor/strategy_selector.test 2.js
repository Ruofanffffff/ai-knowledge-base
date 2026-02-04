/**
 * Unit Tests for Strategy Selector
 */

const strategySelector = require('./strategy_selector');

describe('Strategy Selector', () => {
  describe('selectStrategy', () => {
    test('should select semantic-only for travel domain', () => {
      const result = strategySelector.selectStrategy('travel');
      
      expect(result.strategy).toBe('semantic-only');
      expect(result.promptBuilder).toBe('buildTravelFieldExtractionPrompt');
      expect(result.useLLM).toBe(true);
      expect(result.useRules).toBe(false);
      expect(result.useNER).toBe(false);
      expect(result.reason).toContain('travel');
      expect(result.executionTime).toBeLessThan(5); // Performance requirement
    });
    
    test('should select hybrid for medical domain', () => {
      const result = strategySelector.selectStrategy('medical');
      
      expect(result.strategy).toBe('hybrid');
      expect(result.useLLM).toBe(true);
      expect(result.useRules).toBe(true);
      expect(result.useNER).toBe(true);
    });
    
    test('should select rule-first for government domain', () => {
      const result = strategySelector.selectStrategy('government');
      
      expect(result.strategy).toBe('rule-first');
      expect(result.useLLM).toBe(true);
      expect(result.useRules).toBe(true);
      expect(result.useNER).toBe(true);
    });
    
    test('should select rule-first for legal domain', () => {
      const result = strategySelector.selectStrategy('legal');
      
      expect(result.strategy).toBe('rule-first');
    });
    
    test('should select hybrid for financial domain', () => {
      const result = strategySelector.selectStrategy('financial');
      
      expect(result.strategy).toBe('hybrid');
    });
    
    test('should select rule-first for general domain', () => {
      const result = strategySelector.selectStrategy('general');
      
      expect(result.strategy).toBe('rule-first');
    });
    
    test('should respect strategy override in options', () => {
      const result = strategySelector.selectStrategy('travel', {
        strategy: 'hybrid'
      });
      
      expect(result.strategy).toBe('hybrid');
      expect(result.reason).toContain('User override');
    });
    
    test('should throw error for invalid strategy override', () => {
      expect(() => {
        strategySelector.selectStrategy('travel', {
          strategy: 'invalid-strategy'
        });
      }).toThrow('Invalid strategy');
    });
    
    test('should include strategy configuration', () => {
      const result = strategySelector.selectStrategy('travel');
      
      expect(result.config).toBeDefined();
      expect(result.config.useLLM).toBeDefined();
      expect(result.config.useRules).toBeDefined();
      expect(result.config.useNER).toBeDefined();
    });
    
    test('should complete within performance requirement', () => {
      const result = strategySelector.selectStrategy('travel');
      
      expect(result.executionTime).toBeLessThan(5); // < 5ms requirement
    });
    
    test('should use custom configuration if provided', () => {
      const customConfig = {
        defaultStrategies: {
          travel: 'rule-first'
        },
        promptBuilders: {
          travel: 'customPromptBuilder'
        },
        strategyConfig: {
          'rule-first': {
            useLLM: true,
            useRules: true,
            useNER: true
          }
        }
      };
      
      const result = strategySelector.selectStrategy('travel', {}, customConfig);
      
      expect(result.strategy).toBe('rule-first');
      expect(result.promptBuilder).toBe('customPromptBuilder');
    });
  });
  
  describe('getDefaultStrategy', () => {
    test('should return semantic-only for travel', () => {
      const strategy = strategySelector.getDefaultStrategy('travel');
      expect(strategy).toBe('semantic-only');
    });
    
    test('should return hybrid for medical', () => {
      const strategy = strategySelector.getDefaultStrategy('medical');
      expect(strategy).toBe('hybrid');
    });
    
    test('should return rule-first for government', () => {
      const strategy = strategySelector.getDefaultStrategy('government');
      expect(strategy).toBe('rule-first');
    });
    
    test('should return rule-first for unknown domain', () => {
      const strategy = strategySelector.getDefaultStrategy('unknown');
      expect(strategy).toBe('rule-first');
    });
    
    test('should use custom strategies if provided', () => {
      const customStrategies = {
        travel: 'hybrid'
      };
      
      const strategy = strategySelector.getDefaultStrategy('travel', customStrategies);
      expect(strategy).toBe('hybrid');
    });
  });
  
  describe('isValidStrategy', () => {
    test('should return true for valid strategies', () => {
      expect(strategySelector.isValidStrategy('rule-first')).toBe(true);
      expect(strategySelector.isValidStrategy('llm-first')).toBe(true);
      expect(strategySelector.isValidStrategy('semantic-only')).toBe(true);
      expect(strategySelector.isValidStrategy('hybrid')).toBe(true);
    });
    
    test('should return false for invalid strategies', () => {
      expect(strategySelector.isValidStrategy('invalid')).toBe(false);
      expect(strategySelector.isValidStrategy('')).toBe(false);
      expect(strategySelector.isValidStrategy(null)).toBe(false);
    });
  });
  
  describe('getStrategyConfig', () => {
    test('should return configuration for valid strategy', () => {
      const config = strategySelector.getStrategyConfig('semantic-only');
      
      expect(config).toBeDefined();
      expect(config.useLLM).toBe(true);
      expect(config.useRules).toBe(false);
      expect(config.useNER).toBe(false);
    });
    
    test('should throw error for invalid strategy', () => {
      expect(() => {
        strategySelector.getStrategyConfig('invalid');
      }).toThrow('Invalid strategy');
    });
  });
  
  describe('getPromptBuilder', () => {
    test('should return travel prompt builder for travel domain', () => {
      const builder = strategySelector.getPromptBuilder('travel');
      expect(builder).toBe('buildTravelFieldExtractionPrompt');
    });
    
    test('should return semantic prompt builder for medical domain', () => {
      const builder = strategySelector.getPromptBuilder('medical');
      expect(builder).toBe('buildSemanticFieldExtractionPrompt');
    });
    
    test('should return default prompt builder for unknown domain', () => {
      const builder = strategySelector.getPromptBuilder('unknown');
      expect(builder).toBe('buildFieldExtractionPrompt');
    });
  });
  
  describe('getAvailableStrategies', () => {
    test('should return list of all supported strategies', () => {
      const strategies = strategySelector.getAvailableStrategies();
      
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies).toContain('rule-first');
      expect(strategies).toContain('llm-first');
      expect(strategies).toContain('semantic-only');
      expect(strategies).toContain('hybrid');
    });
  });
  
  describe('getStrategyDescription', () => {
    test('should return description for valid strategies', () => {
      const desc1 = strategySelector.getStrategyDescription('rule-first');
      expect(desc1).toContain('Rule+NER');
      
      const desc2 = strategySelector.getStrategyDescription('semantic-only');
      expect(desc2).toContain('semantic');
    });
    
    test('should return unknown for invalid strategy', () => {
      const desc = strategySelector.getStrategyDescription('invalid');
      expect(desc).toContain('Unknown');
    });
  });
});
