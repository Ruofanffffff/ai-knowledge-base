/**
 * Unit tests for Configuration Manager
 */

const fs = require('fs');
const path = require('path');
const Configuration = require('./configuration');
const { DEFAULT_CONFIG } = require('./constants');

describe('Configuration Manager', () => {
  const testConfigPath = path.join(__dirname, 'test-config.json');

  afterEach(() => {
    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    // Clean up environment variables
    delete process.env.LLM_ENABLED;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_TIMEOUT;
  });

  describe('Constructor', () => {
    test('should create configuration with defaults', () => {
      const config = new Configuration();
      expect(config.get('llm.enabled')).toBe(DEFAULT_CONFIG.llm.enabled);
      expect(config.get('llm.model')).toBe(DEFAULT_CONFIG.llm.model);
      expect(config.get('algorithm.enabled')).toBe(DEFAULT_CONFIG.algorithm.enabled);
    });

    test('should merge user config with defaults', () => {
      const config = new Configuration({
        llm: {
          model: 'custom-model',
          timeout: 60000
        }
      });

      expect(config.get('llm.model')).toBe('custom-model');
      expect(config.get('llm.timeout')).toBe(60000);
      expect(config.get('llm.enabled')).toBe(DEFAULT_CONFIG.llm.enabled);
    });

    test('should validate configuration on creation', () => {
      expect(() => {
        new Configuration({
          llm: { timeout: -1000 }
        });
      }).toThrow('LLM timeout must be positive');

      expect(() => {
        new Configuration({
          fusion: { conflictStrategy: 'invalid_strategy' }
        });
      }).toThrow('Invalid conflict strategy');
    });
  });

  describe('fromFile', () => {
    test('should load configuration from file', () => {
      const testConfig = {
        llm: {
          model: 'file-model',
          timeout: 45000
        }
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig), 'utf8');

      const config = Configuration.fromFile(testConfigPath);
      expect(config.get('llm.model')).toBe('file-model');
      expect(config.get('llm.timeout')).toBe(45000);
    });

    test('should use defaults when file not found (Requirement 9.6)', () => {
      const config = Configuration.fromFile('/nonexistent/config.json');
      expect(config.get('llm.model')).toBe(DEFAULT_CONFIG.llm.model);
      expect(config.get('llm.enabled')).toBe(DEFAULT_CONFIG.llm.enabled);
    });

    test('should use defaults when file is invalid JSON', () => {
      fs.writeFileSync(testConfigPath, 'invalid json', 'utf8');
      const config = Configuration.fromFile(testConfigPath);
      expect(config.get('llm.model')).toBe(DEFAULT_CONFIG.llm.model);
    });
  });

  describe('fromEnv', () => {
    test('should load configuration from environment variables', () => {
      process.env.LLM_MODEL = 'env-model';
      process.env.LLM_TIMEOUT = '50000';
      process.env.LLM_ENABLED = 'true';

      const config = Configuration.fromEnv();
      expect(config.get('llm.model')).toBe('env-model');
      expect(config.get('llm.timeout')).toBe(50000);
      expect(config.get('llm.enabled')).toBe(true);
    });

    test('should use defaults when env vars not set', () => {
      const config = Configuration.fromEnv();
      expect(config.get('llm.model')).toBe(DEFAULT_CONFIG.llm.model);
      expect(config.get('llm.timeout')).toBe(DEFAULT_CONFIG.llm.timeout);
    });

    test('should handle boolean env vars', () => {
      process.env.LLM_ENABLED = 'false';
      process.env.ALGORITHM_ENABLED = 'false';

      const config = Configuration.fromEnv();
      expect(config.get('llm.enabled')).toBe(false);
      expect(config.get('algorithm.enabled')).toBe(false);
    });
  });

  describe('get and set', () => {
    test('should get nested configuration values', () => {
      const config = new Configuration();
      expect(config.get('llm.model')).toBe(DEFAULT_CONFIG.llm.model);
      expect(config.get('performance.batchSize')).toBe(DEFAULT_CONFIG.performance.batchSize);
    });

    test('should return undefined for non-existent paths', () => {
      const config = new Configuration();
      expect(config.get('nonexistent.path')).toBeUndefined();
    });

    test('should set configuration values', () => {
      const config = new Configuration();
      config.set('llm.model', 'new-model');
      expect(config.get('llm.model')).toBe('new-model');
    });

    test('should validate after setting values', () => {
      const config = new Configuration();
      expect(() => {
        config.set('llm.timeout', -1000);
      }).toThrow('LLM timeout must be positive');
    });
  });

  describe('Validation', () => {
    test('should validate LLM configuration', () => {
      expect(() => new Configuration({ llm: { timeout: 0 } })).toThrow();
      expect(() => new Configuration({ llm: { maxRetries: -1 } })).toThrow();
      expect(() => new Configuration({ llm: { temperature: 3 } })).toThrow();
      expect(() => new Configuration({ llm: { maxTokens: 0 } })).toThrow();
    });

    test('should validate fusion configuration', () => {
      expect(() => new Configuration({ fusion: { conflictStrategy: 'invalid' } })).toThrow();
      expect(() => new Configuration({ fusion: { confidenceThreshold: 1.5 } })).toThrow();
      expect(() => new Configuration({ fusion: { confidenceThreshold: -0.1 } })).toThrow();
    });

    test('should validate performance configuration', () => {
      expect(() => new Configuration({ performance: { cacheExpiry: -1 } })).toThrow();
      expect(() => new Configuration({ performance: { batchSize: 0 } })).toThrow();
      expect(() => new Configuration({ performance: { maxProcessingTime: -100 } })).toThrow();
    });

    test('should validate quality configuration', () => {
      expect(() => new Configuration({ quality: { minEntities: -1 } })).toThrow();
      expect(() => new Configuration({ quality: { minRelations: -1 } })).toThrow();
      expect(() => new Configuration({ quality: { minConfidence: 1.5 } })).toThrow();
    });

    test('should validate language configuration', () => {
      expect(() => new Configuration({ language: { default: 'invalid' } })).toThrow();
    });
  });

  describe('getAll and toJSON', () => {
    test('should return full configuration object', () => {
      const config = new Configuration();
      const all = config.getAll();
      expect(all).toHaveProperty('llm');
      expect(all).toHaveProperty('algorithm');
      expect(all).toHaveProperty('fusion');
      expect(all).toHaveProperty('performance');
      expect(all).toHaveProperty('quality');
      expect(all).toHaveProperty('language');
    });

    test('should export configuration to JSON', () => {
      const config = new Configuration();
      const json = config.toJSON();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('llm');
      expect(parsed.llm).toHaveProperty('model');
    });
  });

  describe('saveToFile', () => {
    test('should save configuration to file', () => {
      const config = new Configuration({
        llm: { model: 'save-test-model' }
      });
      config.saveToFile(testConfigPath);

      expect(fs.existsSync(testConfigPath)).toBe(true);
      const loaded = Configuration.fromFile(testConfigPath);
      expect(loaded.get('llm.model')).toBe('save-test-model');
    });

    test('should create directory if not exists', () => {
      const nestedPath = path.join(__dirname, 'nested', 'dir', 'config.json');
      const config = new Configuration();
      config.saveToFile(nestedPath);

      expect(fs.existsSync(nestedPath)).toBe(true);
      
      // Cleanup
      fs.unlinkSync(nestedPath);
      fs.rmdirSync(path.dirname(nestedPath));
      fs.rmdirSync(path.join(__dirname, 'nested'));
    });
  });
});
