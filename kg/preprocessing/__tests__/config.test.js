/**
 * Unit Tests for Preprocessing Configuration
 * 
 * Tests the configuration loading, validation, and default values
 * 
 * Requirements: 1.5, 8.5
 */

describe('Preprocessing Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };
    
    // 清除所有预处理相关的环境变量
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('LLM_PREPROCESSING_') || key === 'ENABLE_LLM_PREPROCESSING') {
        delete process.env[key];
      }
    });

    // 清除模块缓存
    jest.resetModules();
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('Default Configuration', () => {
    test('should load default values when no environment variables are set', () => {
      const { config } = require('../config');

      expect(config.enabled).toBe(false);
      expect(config.temperature).toBe(0.1);
      expect(config.maxTokens).toBe(2000);
      expect(config.timeouts.documentIndex).toBe(30000);
      expect(config.timeouts.cbkCorrection).toBe(10000);
      expect(config.timeouts.fieldCorrection).toBe(15000);
      expect(config.timeouts.schemaCorrection).toBe(10000);
      expect(config.timeouts.mergeCorrection).toBe(10000);
      expect(config.timeouts.relationCorrection).toBe(20000);
      expect(config.timeouts.graphDescription).toBe(30000);
      expect(config.concurrency.maxConcurrent).toBe(5);
      expect(config.concurrency.queueTimeout).toBe(60000);
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.maxSize).toBe(1000);
      expect(config.cache.ttl).toBe(3600000);
      expect(config.thresholds.fieldCoverage).toBe(0.8);
      expect(config.thresholds.relationCoverage).toBe(0.7);
      expect(config.thresholds.schemaConfidence).toBe(0.75);
    });
  });

  describe('Environment Variable Loading', () => {
    test('should load enabled flag from environment', () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.enabled).toBe(true);
    });

    test('should load temperature from environment', () => {
      process.env.LLM_PREPROCESSING_TEMPERATURE = '0.5';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.temperature).toBe(0.5);
    });

    test('should load max tokens from environment', () => {
      process.env.LLM_PREPROCESSING_MAX_TOKENS = '3000';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.maxTokens).toBe(3000);
    });

    test('should load timeout configurations from environment', () => {
      process.env.LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT = '45000';
      process.env.LLM_PREPROCESSING_CBK_CORRECTION_TIMEOUT = '15000';
      process.env.LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT = '20000';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.timeouts.documentIndex).toBe(45000);
      expect(config.timeouts.cbkCorrection).toBe(15000);
      expect(config.timeouts.fieldCorrection).toBe(20000);
    });

    test('should load concurrency configurations from environment', () => {
      process.env.LLM_PREPROCESSING_MAX_CONCURRENCY = '10';
      process.env.LLM_PREPROCESSING_QUEUE_TIMEOUT = '90000';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.concurrency.maxConcurrent).toBe(10);
      expect(config.concurrency.queueTimeout).toBe(90000);
    });

    test('should load cache configurations from environment', () => {
      process.env.LLM_PREPROCESSING_CACHE_ENABLED = 'false';
      process.env.LLM_PREPROCESSING_CACHE_MAX_SIZE = '500';
      process.env.LLM_PREPROCESSING_CACHE_TTL = '1800000';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.cache.enabled).toBe(false);
      expect(config.cache.maxSize).toBe(500);
      expect(config.cache.ttl).toBe(1800000);
    });

    test('should load threshold configurations from environment', () => {
      process.env.LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD = '0.9';
      process.env.LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD = '0.75';
      process.env.LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD = '0.8';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.thresholds.fieldCoverage).toBe(0.9);
      expect(config.thresholds.relationCoverage).toBe(0.75);
      expect(config.thresholds.schemaConfidence).toBe(0.8);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', () => {
      const { validateConfig } = require('../config');
      const result = validateConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid temperature', () => {
      process.env.LLM_PREPROCESSING_TEMPERATURE = '1.5';
      jest.resetModules();

      expect(() => {
        require('../config');
      }).toThrow('Invalid preprocessing configuration');
    });

    test('should detect invalid threshold values', () => {
      process.env.LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD = '1.5';
      jest.resetModules();

      expect(() => {
        require('../config');
      }).toThrow('Invalid preprocessing configuration');
    });

    test('should detect invalid concurrency', () => {
      process.env.LLM_PREPROCESSING_MAX_CONCURRENCY = '0';
      jest.resetModules();

      expect(() => {
        require('../config');
      }).toThrow('Invalid preprocessing configuration');
    });

    test('should warn about very short timeouts', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      process.env.LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT = '500';
      jest.resetModules();
      require('../config');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnings = consoleWarnSpy.mock.calls[0][1];
      expect(warnings.some(w => w.includes('less than 1 second'))).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    test('should warn about very long timeouts', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      process.env.LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT = '150000';
      jest.resetModules();
      require('../config');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnings = consoleWarnSpy.mock.calls[0][1];
      expect(warnings.some(w => w.includes('greater than 2 minutes'))).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    test('should warn about high concurrency', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      process.env.LLM_PREPROCESSING_MAX_CONCURRENCY = '25';
      jest.resetModules();
      require('../config');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnings = consoleWarnSpy.mock.calls[0][1];
      expect(warnings.some(w => w.includes('High concurrency'))).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    test('should warn about small cache size', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      process.env.LLM_PREPROCESSING_CACHE_MAX_SIZE = '5';
      jest.resetModules();
      require('../config');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnings = consoleWarnSpy.mock.calls[0][1];
      expect(warnings.some(w => w.includes('very small'))).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    test('should warn about short cache TTL', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      process.env.LLM_PREPROCESSING_CACHE_TTL = '30000';
      jest.resetModules();
      require('../config');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnings = consoleWarnSpy.mock.calls[0][1];
      expect(warnings.some(w => w.includes('less than 1 minute'))).toBe(true);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('LatencyControlManager Options', () => {
    test('should generate correct options for LatencyControlManager', () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      process.env.LLM_PREPROCESSING_MAX_CONCURRENCY = '8';
      process.env.LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD = '0.85';
      jest.resetModules();
      
      const { getLatencyControlOptions } = require('../config');
      const options = getLatencyControlOptions();

      expect(options).toHaveProperty('documentIndexTimeout');
      expect(options).toHaveProperty('cbkCorrectionTimeout');
      expect(options).toHaveProperty('fieldCorrectionTimeout');
      expect(options).toHaveProperty('maxConcurrency', 8);
      expect(options).toHaveProperty('cacheEnabled');
      expect(options).toHaveProperty('fieldCoverageThreshold', 0.85);
    });

    test('should include all required timeout configurations', () => {
      const { getLatencyControlOptions } = require('../config');
      const options = getLatencyControlOptions();

      expect(options.documentIndexTimeout).toBeDefined();
      expect(options.cbkCorrectionTimeout).toBeDefined();
      expect(options.fieldCorrectionTimeout).toBeDefined();
      expect(options.schemaCorrectionTimeout).toBeDefined();
      expect(options.mergeCorrectionTimeout).toBeDefined();
      expect(options.relationCorrectionTimeout).toBeDefined();
      expect(options.graphDescriptionTimeout).toBeDefined();
    });

    test('should include all required threshold configurations', () => {
      const { getLatencyControlOptions } = require('../config');
      const options = getLatencyControlOptions();

      expect(options.fieldCoverageThreshold).toBeDefined();
      expect(options.relationCoverageThreshold).toBeDefined();
      expect(options.schemaConfidenceThreshold).toBeDefined();
    });
  });

  describe('Configuration Printing', () => {
    test('should print configuration without errors', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const { printConfig } = require('../config');
      printConfig();

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls.some(call => 
        call[0].includes('LLM Preprocessing Configuration')
      )).toBe(true);

      consoleLogSpy.mockRestore();
    });
  });

  describe('Boolean Parsing', () => {
    test('should parse "true" as true', () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.enabled).toBe(true);
    });

    test('should parse "1" as true', () => {
      process.env.ENABLE_LLM_PREPROCESSING = '1';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.enabled).toBe(true);
    });

    test('should parse "false" as false', () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'false';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.enabled).toBe(false);
    });

    test('should parse "0" as false', () => {
      process.env.ENABLE_LLM_PREPROCESSING = '0';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.enabled).toBe(false);
    });
  });

  describe('Number Parsing', () => {
    test('should handle invalid integer values', () => {
      process.env.LLM_PREPROCESSING_MAX_TOKENS = 'invalid';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.maxTokens).toBe(2000); // Should use default
    });

    test('should handle invalid float values', () => {
      process.env.LLM_PREPROCESSING_TEMPERATURE = 'invalid';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.temperature).toBe(0.1); // Should use default
    });

    test('should parse valid integer strings', () => {
      process.env.LLM_PREPROCESSING_MAX_TOKENS = '5000';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.maxTokens).toBe(5000);
    });

    test('should parse valid float strings', () => {
      process.env.LLM_PREPROCESSING_TEMPERATURE = '0.3';
      jest.resetModules();
      const { config } = require('../config');

      expect(config.temperature).toBe(0.3);
    });
  });

  describe('Configuration Immutability', () => {
    test('should not allow direct modification of config object', () => {
      const { config } = require('../config');
      const originalEnabled = config.enabled;

      // 尝试修改配置
      config.enabled = !originalEnabled;

      // 重新导入模块，配置应该保持不变
      jest.resetModules();
      const { config: newConfig } = require('../config');
      
      expect(newConfig.enabled).toBe(originalEnabled);
    });
  });
});
