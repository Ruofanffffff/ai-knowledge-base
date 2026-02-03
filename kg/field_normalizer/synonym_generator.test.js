/**
 * Tests for Synonym Generator
 */

const SynonymGenerator = require('./synonym_generator');
const fs = require('fs').promises;
const path = require('path');

describe('SynonymGenerator', () => {
  let generator;
  const testDictPath = path.join(__dirname, 'test_synonym_dict.json');

  beforeEach(() => {
    generator = new SynonymGenerator({
      apiKey: process.env.QWEN_API_KEY || 'test-key',
      dictPath: testDictPath
    });
  });

  afterEach(async () => {
    // Clean up test dictionary
    try {
      await fs.unlink(testDictPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('loadDict', () => {
    it('should load existing dictionary', async () => {
      // Create test dictionary
      const testDict = {
        '时间': {
          synonyms: ['日期', '时刻'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 10
        }
      };
      await fs.writeFile(testDictPath, JSON.stringify(testDict), 'utf-8');

      const dict = await generator.loadDict();
      expect(dict).toEqual(testDict);
      expect(generator.dict).toEqual(testDict);
    });

    it('should return empty dict if file does not exist', async () => {
      const dict = await generator.loadDict();
      expect(dict).toEqual({});
      expect(generator.dict).toEqual({});
    });
  });

  describe('saveDict', () => {
    it('should save dictionary to file', async () => {
      generator.dict = {
        '区域': {
          synonyms: ['地区', '地点'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 5
        }
      };

      await generator.saveDict();

      const content = await fs.readFile(testDictPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved).toEqual(generator.dict);
    });
  });

  describe('generateInitialDict', () => {
    it('should generate initial dictionary with LLM', async () => {
      // Mock LLM client
      generator.client = {
        callJSON: jest.fn().mockResolvedValue({
          '时间': {
            synonyms: ['日期', '时刻', '时段', '时间点', '发生时间', '记录时间', '啥时候', '何时'],
            domain: ['通用'],
            confidence: 1.0,
            usage_count: 0
          },
          '区域': {
            synonyms: ['地区', '地域', '区', '地点', '位置', '场所', '发生地点', 'location'],
            domain: ['通用', '科研', '政务'],
            confidence: 1.0,
            usage_count: 0
          },
          _meta: { tokens: { input: 500, output: 800, total: 1300 } }
        })
      };

      const result = await generator.generateInitialDict();

      expect(result.success).toBe(true);
      expect(result.totalFields).toBeGreaterThan(0);
      expect(result.totalSynonyms).toBeGreaterThan(0);
      expect(result.tokens).toBeDefined();
      expect(generator.client.callJSON).toHaveBeenCalled();

      // Verify dictionary was saved
      const dict = await generator.loadDict();
      expect(dict['时间']).toBeDefined();
      expect(dict['时间'].synonyms).toContain('日期');
      expect(dict['区域']).toBeDefined();
      expect(dict['区域'].synonyms).toContain('地区');
    });

    it('should merge with existing dictionary', async () => {
      // Create existing dictionary
      generator.dict = {
        '时间': {
          synonyms: ['日期'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 10
        }
      };
      await generator.saveDict();

      // Mock LLM client
      generator.client = {
        callJSON: jest.fn().mockResolvedValue({
          '时间': {
            synonyms: ['时刻', '时段'],  // New synonyms
            domain: ['科研'],  // New domain
            confidence: 1.0,
            usage_count: 0
          },
          _meta: { tokens: { input: 500, output: 300, total: 800 } }
        })
      };

      await generator.generateInitialDict();

      const dict = await generator.loadDict();
      expect(dict['时间'].synonyms).toContain('日期');  // Existing
      expect(dict['时间'].synonyms).toContain('时刻');  // New
      expect(dict['时间'].synonyms).toContain('时段');  // New
      expect(dict['时间'].domain).toContain('通用');  // Existing
      expect(dict['时间'].domain).toContain('科研');  // New
    });
  });

  describe('expandDomainSynonyms', () => {
    it('should expand synonyms for specific domain', async () => {
      // Create initial dictionary
      generator.dict = {
        '时间': {
          synonyms: ['日期'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 0
        }
      };
      await generator.saveDict();

      // Mock LLM client
      generator.client = {
        callJSON: jest.fn().mockResolvedValue({
          '时间': {
            synonyms: ['实验时间', '记录时间'],
            domain: ['科研'],
            confidence: 0.9,
            usage_count: 0
          },
          '指标': {
            synonyms: ['实验指标', 'KPI', '考核指标'],
            domain: ['科研'],
            confidence: 0.9,
            usage_count: 0
          },
          _meta: { tokens: { input: 400, output: 500, total: 900 } }
        })
      };

      const result = await generator.expandDomainSynonyms('科研');

      expect(result.success).toBe(true);
      expect(result.domain).toBe('科研');
      expect(result.addedFields).toBeGreaterThanOrEqual(1);
      expect(result.addedSynonyms).toBeGreaterThan(0);

      const dict = await generator.loadDict();
      expect(dict['时间'].synonyms).toContain('日期');  // Existing
      expect(dict['时间'].synonyms).toContain('实验时间');  // New
      expect(dict['时间'].domain).toContain('科研');
      expect(dict['指标']).toBeDefined();
      expect(dict['指标'].synonyms).toContain('实验指标');
    });
  });

  describe('learnFromUnmappedFields', () => {
    it('should learn mappings from unmapped fields', async () => {
      // Create initial dictionary
      generator.dict = {
        '时间': {
          synonyms: ['日期'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 0
        }
      };
      await generator.saveDict();

      const unmappedFields = ['时刻', '发生时间', '记录日期'];

      // Mock LLM client
      generator.client = {
        callJSON: jest.fn().mockResolvedValue({
          mappings: [
            { raw: '时刻', standard: '时间', confidence: 0.95 },
            { raw: '发生时间', standard: '时间', confidence: 0.9 },
            { raw: '记录日期', standard: '时间', confidence: 0.85 }
          ],
          new_standards: [],
          _meta: { tokens: { input: 300, output: 200, total: 500 } }
        })
      };

      const result = await generator.learnFromUnmappedFields(unmappedFields);

      expect(result.success).toBe(true);
      expect(result.learnedMappings).toBe(3);
      expect(result.newStandards).toBe(0);

      const dict = await generator.loadDict();
      expect(dict['时间'].synonyms).toContain('时刻');
      expect(dict['时间'].synonyms).toContain('发生时间');
      expect(dict['时间'].synonyms).toContain('记录日期');
    });

    it('should add new standard fields', async () => {
      generator.dict = {};
      await generator.saveDict();

      const unmappedFields = ['网络安全等级', '等保等级'];

      // Mock LLM client
      generator.client = {
        callJSON: jest.fn().mockResolvedValue({
          mappings: [],
          new_standards: [
            {
              name: '安全等级',
              synonyms: ['网络安全等级', '等保等级', '防护等级'],
              domain: ['网信工作', '政务'],
              confidence: 0.9
            }
          ],
          _meta: { tokens: { input: 250, output: 180, total: 430 } }
        })
      };

      const result = await generator.learnFromUnmappedFields(unmappedFields);

      expect(result.success).toBe(true);
      expect(result.newStandards).toBe(1);

      const dict = await generator.loadDict();
      expect(dict['安全等级']).toBeDefined();
      expect(dict['安全等级'].synonyms).toContain('网络安全等级');
      expect(dict['安全等级'].domain).toContain('网信工作');
    });

    it('should handle empty unmapped fields', async () => {
      const result = await generator.learnFromUnmappedFields([]);
      expect(result.success).toBe(true);
      expect(result.mappings).toEqual([]);
      expect(result.newStandards).toEqual([]);
    });
  });

  describe('evaluateQuality', () => {
    it('should evaluate dictionary coverage', async () => {
      // Create test dictionary
      generator.dict = {
        '时间': {
          synonyms: ['日期', '时刻', '时段'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 0
        },
        '区域': {
          synonyms: ['地区', '地点'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 0
        }
      };
      await generator.saveDict();

      const testSet = [
        { fieldName: '时间', expectedStandard: '时间' },
        { fieldName: '日期', expectedStandard: '时间' },
        { fieldName: '区域', expectedStandard: '区域' },
        { fieldName: '地区', expectedStandard: '区域' },
        { fieldName: '未知字段', expectedStandard: null }
      ];

      const result = await generator.evaluateQuality(testSet);

      expect(result.total).toBe(5);
      expect(result.covered).toBe(4);
      expect(result.coverageRate).toBe(0.8);
      expect(result.passed).toBe(false);  // Below 0.9 threshold
      expect(result.uncoveredFields).toHaveLength(1);
      expect(result.uncoveredFields[0].fieldName).toBe('未知字段');
    });

    it('should pass quality check with high coverage', async () => {
      generator.dict = {
        '时间': { synonyms: ['日期'], domain: ['通用'], confidence: 1.0, usage_count: 0 },
        '区域': { synonyms: ['地区'], domain: ['通用'], confidence: 1.0, usage_count: 0 },
        '数值': { synonyms: ['值'], domain: ['通用'], confidence: 1.0, usage_count: 0 }
      };
      await generator.saveDict();

      const testSet = [
        { fieldName: '时间' },
        { fieldName: '日期' },
        { fieldName: '区域' },
        { fieldName: '地区' },
        { fieldName: '数值' },
        { fieldName: '值' },
        { fieldName: '未知1' },
        { fieldName: '未知2' },
        { fieldName: '未知3' },
        { fieldName: '未知4' }
      ];

      const result = await generator.evaluateQuality(testSet);

      expect(result.coverageRate).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('getStats', () => {
    it('should return dictionary statistics', async () => {
      generator.dict = {
        '时间': {
          synonyms: ['日期', '时刻', '时段'],
          domain: ['通用', '科研'],
          confidence: 1.0,
          usage_count: 150
        },
        '区域': {
          synonyms: ['地区', '地点'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 50
        },
        '指标': {
          synonyms: ['参数', '度量'],
          domain: ['科研'],
          confidence: 0.9,
          usage_count: 5
        },
        '未使用': {
          synonyms: ['test'],
          domain: ['测试'],
          confidence: 0.8,
          usage_count: 0
        }
      };
      await generator.saveDict();

      const stats = await generator.getStats();

      expect(stats.totalFields).toBe(4);
      expect(stats.totalSynonyms).toBe(8);
      expect(parseFloat(stats.avgSynonymsPerField)).toBe(2.0);
      
      expect(stats.domainStats['通用']).toBeDefined();
      expect(stats.domainStats['通用'].fields).toBe(2);
      expect(stats.domainStats['科研']).toBeDefined();
      expect(stats.domainStats['科研'].fields).toBe(2);

      expect(stats.usageStats.high).toBe(1);  // 时间: 150
      expect(stats.usageStats.medium).toBe(1);  // 区域: 50
      expect(stats.usageStats.low).toBe(1);  // 指标: 5
      expect(stats.usageStats.unused).toBe(1);  // 未使用: 0
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count for standard field', async () => {
      generator.dict = {
        '时间': {
          synonyms: ['日期'],
          domain: ['通用'],
          confidence: 1.0,
          usage_count: 10
        }
      };
      await generator.saveDict();

      await generator.incrementUsage('时间');

      const dict = await generator.loadDict();
      expect(dict['时间'].usage_count).toBe(11);
    });

    it('should initialize usage count if not present', async () => {
      generator.dict = {
        '时间': {
          synonyms: ['日期'],
          domain: ['通用'],
          confidence: 1.0
        }
      };
      await generator.saveDict();

      await generator.incrementUsage('时间');

      const dict = await generator.loadDict();
      expect(dict['时间'].usage_count).toBe(1);
    });

    it('should handle non-existent field gracefully', async () => {
      generator.dict = {};
      await generator.saveDict();

      await expect(generator.incrementUsage('不存在')).resolves.not.toThrow();
    });
  });
});
