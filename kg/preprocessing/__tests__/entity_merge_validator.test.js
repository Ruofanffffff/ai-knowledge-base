/**
 * Unit Tests for Entity Merge Validator
 * 
 * Tests the entity merge validation functionality
 */

const EntityMergeValidator = require('../entity_merge_validator');

describe('EntityMergeValidator', () => {
  let validator;
  let mockLLMClient;
  
  beforeEach(() => {
    validator = new EntityMergeValidator({
      temperature: 0.1,
      timeout: 5000,
      maxRetries: 2
    });
    
    // Mock LLM client
    mockLLMClient = {
      chat: jest.fn()
    };
  });
  
  describe('validateMergeDecision', () => {
    it('should validate that entities should merge when they refer to the same object', async () => {
      const entity1 = {
        entity_id: 'entity_1',
        canonical_name: '阿里C区',
        entity_type: 'Location',
        anchor_fields: { location: '阿里C区' },
        fields: { province: '海南省', city: '海口市' }
      };
      
      const entity2 = {
        entity_id: 'entity_2',
        canonical_name: '阿里C区监测点',
        entity_type: 'Location',
        anchor_fields: { location: '阿里C区' },
        fields: { province: '海南省', district: '美兰区' }
      };
      
      const indexedText = `1. 阿里C区位于海南省海口市美兰区。
2. 阿里C区监测点编号为ALI-C-001。
3. 该监测点负责监测阿里C区的地下水位。`;
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: true,
          reason: '索引文本第1和第3条明确表明"阿里C区"和"阿里C区监测点"指向同一地理位置',
          confidence: 0.9,
          evidence_indices: [1, 3]
        })
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.shouldMerge).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.validated).toBe(true);
      expect(result.evidenceIndices).toContain(1);
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);
    });
    
    it('should validate that entities should not merge when they refer to different objects', async () => {
      const entity1 = {
        entity_id: 'entity_1',
        canonical_name: '阿里C区',
        entity_type: 'Location',
        anchor_fields: { location: '阿里C区' },
        fields: { province: '海南省' }
      };
      
      const entity2 = {
        entity_id: 'entity_2',
        canonical_name: '阿里D区',
        entity_type: 'Location',
        anchor_fields: { location: '阿里D区' },
        fields: { province: '海南省' }
      };
      
      const indexedText = `1. 阿里C区位于海南省海口市美兰区。
2. 阿里D区位于海南省三亚市天涯区。
3. 两个区域相距约200公里。`;
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: false,
          reason: '索引文本第1和第2条明确表明这是两个不同的地理位置',
          confidence: 0.95,
          evidence_indices: [1, 2, 3]
        })
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.shouldMerge).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.validated).toBe(true);
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);
    });
    
    it('should skip validation when indexedText is missing', async () => {
      const entity1 = { entity_id: 'entity_1', name: 'Entity 1' };
      const entity2 = { entity_id: 'entity_2', name: 'Entity 2' };
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        null,
        mockLLMClient
      );
      
      expect(result.validated).toBe(false);
      expect(result.reason).toContain('No indexed text');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    it('should skip validation when entities are missing', async () => {
      const indexedText = '1. Some text';
      
      const result = await validator.validateMergeDecision(
        null,
        null,
        indexedText,
        mockLLMClient
      );
      
      expect(result.validated).toBe(false);
      expect(result.reason).toContain('Missing entities');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    it('should skip validation when LLM client is missing', async () => {
      const entity1 = { entity_id: 'entity_1', name: 'Entity 1' };
      const entity2 = { entity_id: 'entity_2', name: 'Entity 2' };
      const indexedText = '1. Some text';
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        null
      );
      
      expect(result.validated).toBe(false);
      expect(result.reason).toContain('No LLM client');
    });
    
    it('should handle LLM call failures gracefully', async () => {
      const entity1 = { entity_id: 'entity_1', name: 'Entity 1' };
      const entity2 = { entity_id: 'entity_2', name: 'Entity 2' };
      const indexedText = '1. Some text';
      
      mockLLMClient.chat.mockRejectedValue(new Error('LLM service unavailable'));
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.validated).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });
    
    it('should handle malformed JSON responses', async () => {
      const entity1 = { entity_id: 'entity_1', name: 'Entity 1' };
      const entity2 = { entity_id: 'entity_2', name: 'Entity 2' };
      const indexedText = '1. Some text';
      
      mockLLMClient.chat.mockResolvedValue({
        content: 'This is not valid JSON'
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.validated).toBe(false);
      expect(result.parseError).toBeDefined();
    });
    
    it('should handle JSON wrapped in markdown code blocks', async () => {
      const entity1 = { entity_id: 'entity_1', name: 'Entity 1' };
      const entity2 = { entity_id: 'entity_2', name: 'Entity 2' };
      const indexedText = '1. Some text';
      
      mockLLMClient.chat.mockResolvedValue({
        content: '```json\n{"should_merge": true, "reason": "test", "confidence": 0.8}\n```'
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.validated).toBe(true);
      expect(result.shouldMerge).toBe(true);
      expect(result.confidence).toBe(0.8);
    });
  });
  
  describe('batchValidateMerges', () => {
    it('should validate multiple merge decisions in batch', async () => {
      const mergePairs = [
        {
          entity1: { entity_id: 'e1', name: 'Entity 1' },
          entity2: { entity_id: 'e2', name: 'Entity 2' },
          indexedText: '1. Text about entities'
        },
        {
          entity1: { entity_id: 'e3', name: 'Entity 3' },
          entity2: { entity_id: 'e4', name: 'Entity 4' },
          indexedText: '1. Text about other entities'
        }
      ];
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: true,
          reason: 'test',
          confidence: 0.8
        })
      });
      
      const results = await validator.batchValidateMerges(
        mergePairs,
        mockLLMClient,
        { maxConcurrency: 2 }
      );
      
      expect(results.size).toBe(2);
      expect(results.has('e1_e2')).toBe(true);
      expect(results.has('e3_e4')).toBe(true);
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });
    
    it('should return empty map when no pairs provided', async () => {
      const results = await validator.batchValidateMerges([], mockLLMClient);
      expect(results.size).toBe(0);
    });
    
    it('should skip batch validation when LLM client is missing', async () => {
      const mergePairs = [
        {
          entity1: { entity_id: 'e1', name: 'Entity 1' },
          entity2: { entity_id: 'e2', name: 'Entity 2' },
          indexedText: '1. Text'
        }
      ];
      
      const results = await validator.batchValidateMerges(mergePairs, null);
      expect(results.size).toBe(0);
    });
  });
  
  describe('getValidationStats', () => {
    it('should calculate validation statistics correctly', () => {
      const validationResults = new Map([
        ['pair1', { shouldMerge: true, confidence: 0.9, validated: true }],
        ['pair2', { shouldMerge: false, confidence: 0.8, validated: true }],
        ['pair3', { shouldMerge: true, confidence: 0.85, validated: false }]
      ]);
      
      const stats = validator.getValidationStats(validationResults);
      
      expect(stats.totalPairs).toBe(3);
      expect(stats.shouldMergePairs).toBe(2);
      expect(stats.shouldNotMergePairs).toBe(1);
      expect(stats.validatedPairs).toBe(2);
      expect(parseFloat(stats.mergeRate)).toBeCloseTo(0.67, 1);
      expect(parseFloat(stats.validationRate)).toBeCloseTo(0.67, 1);
      expect(parseFloat(stats.avgConfidence)).toBeCloseTo(0.85, 1);
    });
    
    it('should handle empty results', () => {
      const stats = validator.getValidationStats(new Map());
      
      expect(stats.totalPairs).toBe(0);
      expect(stats.mergeRate).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });
  });
  
  describe('shouldCallLLM', () => {
    it('should return false when no indexed text', () => {
      const entity1 = { entity_id: 'e1' };
      const entity2 = { entity_id: 'e2' };
      
      const result = validator.shouldCallLLM(entity1, entity2, {});
      expect(result).toBe(false);
    });
    
    it('should return true when entity types differ', () => {
      const entity1 = { entity_id: 'e1', entity_type: 'Location' };
      const entity2 = { entity_id: 'e2', entity_type: 'Organization' };
      
      const result = validator.shouldCallLLM(entity1, entity2, { indexedText: 'text' });
      expect(result).toBe(true);
    });
    
    it('should return false when anchor fingerprints are the same', () => {
      const entity1 = { entity_id: 'e1', anchor_fingerprint: 'fp1' };
      const entity2 = { entity_id: 'e2', anchor_fingerprint: 'fp1' };
      
      const result = validator.shouldCallLLM(entity1, entity2, { indexedText: 'text' });
      expect(result).toBe(false);
    });
    
    it('should return true when anchor fingerprints differ', () => {
      const entity1 = { entity_id: 'e1', anchor_fingerprint: 'fp1' };
      const entity2 = { entity_id: 'e2', anchor_fingerprint: 'fp2' };
      
      const result = validator.shouldCallLLM(entity1, entity2, { indexedText: 'text' });
      expect(result).toBe(true);
    });
    
    it('should return true when hasMergeIntent is true', () => {
      const entity1 = { entity_id: 'e1' };
      const entity2 = { entity_id: 'e2' };
      
      const result = validator.shouldCallLLM(entity1, entity2, { 
        indexedText: 'text',
        hasMergeIntent: true 
      });
      expect(result).toBe(true);
    });
  });
  
  describe('_formatEntityAttributes', () => {
    it('should format entity attributes correctly', () => {
      const entity = {
        entity_type: 'Location',
        anchor_fields: { location: '阿里C区', time: '2025-01' },
        fields: { province: '海南省', city: '海口市', district: '美兰区' }
      };
      
      const formatted = validator._formatEntityAttributes(entity);
      
      expect(formatted).toContain('类型=Location');
      expect(formatted).toContain('location=阿里C区');
      expect(formatted).toContain('province=海南省');
    });
    
    it('should handle entities with no attributes', () => {
      const entity = {};
      
      const formatted = validator._formatEntityAttributes(entity);
      
      expect(formatted).toBe('无属性');
    });
    
    it('should handle array values', () => {
      const entity = {
        fields: { tags: ['tag1', 'tag2', 'tag3'] }
      };
      
      const formatted = validator._formatEntityAttributes(entity);
      
      expect(formatted).toContain('tags=tag1,tag2,tag3');
    });
  });
  
  describe('_formatValue', () => {
    it('should format null and undefined', () => {
      expect(validator._formatValue(null)).toBe('null');
      expect(validator._formatValue(undefined)).toBe('null');
    });
    
    it('should format arrays', () => {
      expect(validator._formatValue(['a', 'b', 'c'])).toBe('a,b,c');
      expect(validator._formatValue(['a', 'b', 'c', 'd'])).toBe('a,b,c');
    });
    
    it('should format objects', () => {
      const result = validator._formatValue({ key: 'value' });
      expect(result).toContain('key');
      expect(result).toContain('value');
    });
    
    it('should truncate long strings', () => {
      const longString = 'a'.repeat(100);
      const result = validator._formatValue(longString);
      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
    });
  });
  
  describe('Conflict Resolution', () => {
    it('should resolve conflict when merge decision contradicts entity types', async () => {
      // Entities with different types but LLM says they should merge
      const entity1 = {
        entity_id: 'entity_1',
        canonical_name: '海南省水文局',
        entity_type: 'Organization',
        anchor_fields: { organization: '海南省水文局' }
      };
      
      const entity2 = {
        entity_id: 'entity_2',
        canonical_name: '水文局',
        entity_type: 'Organization',
        anchor_fields: { organization: '水文局' }
      };
      
      const indexedText = `1. 海南省水文局负责管理该监测点。
2. 水文局是海南省水文局的简称。
3. 该机构成立于1985年。`;
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: true,
          reason: '索引文本第2条明确表明"水文局"是"海南省水文局"的简称，指向同一机构',
          confidence: 0.95,
          evidence_indices: [1, 2]
        })
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.shouldMerge).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reason).toContain('简称');
    });
    
    it('should resolve conflict when similar names refer to different entities', async () => {
      // Entities with similar names but different locations
      const entity1 = {
        entity_id: 'entity_1',
        canonical_name: '中心医院',
        entity_type: 'Organization',
        anchor_fields: { organization: '中心医院' },
        fields: { city: '海口市' }
      };
      
      const entity2 = {
        entity_id: 'entity_2',
        canonical_name: '中心医院',
        entity_type: 'Organization',
        anchor_fields: { organization: '中心医院' },
        fields: { city: '三亚市' }
      };
      
      const indexedText = `1. 海口市中心医院位于海口市龙华区。
2. 三亚市中心医院位于三亚市天涯区。
3. 两家医院是独立的医疗机构。`;
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: false,
          reason: '索引文本第1、2、3条明确表明这是两家不同城市的独立医院',
          confidence: 0.9,
          evidence_indices: [1, 2, 3]
        })
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.shouldMerge).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.reason).toContain('独立');
    });
    
    it('should resolve conflict when anchor fingerprints differ but entities are the same', async () => {
      // Different anchor fingerprints but same entity
      const entity1 = {
        entity_id: 'entity_1',
        canonical_name: '张三',
        entity_type: 'Person',
        anchor_fingerprint: 'fp_zhang_san_1',
        anchor_fields: { name: '张三', title: '工程师' }
      };
      
      const entity2 = {
        entity_id: 'entity_2',
        canonical_name: '张三',
        entity_type: 'Person',
        anchor_fingerprint: 'fp_zhang_san_2',
        anchor_fields: { name: '张三', department: '技术部' }
      };
      
      const indexedText = `1. 张三是技术部的工程师。
2. 他负责系统开发工作。
3. 张三于2020年加入公司。`;
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: true,
          reason: '索引文本第1条明确表明"张三"既是工程师又在技术部，是同一人',
          confidence: 0.85,
          evidence_indices: [1]
        })
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.shouldMerge).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
    
    it('should handle ambiguous cases with low confidence', async () => {
      const entity1 = {
        entity_id: 'entity_1',
        canonical_name: '项目A',
        entity_type: 'Project',
        anchor_fields: { project: '项目A' }
      };
      
      const entity2 = {
        entity_id: 'entity_2',
        canonical_name: 'A项目',
        entity_type: 'Project',
        anchor_fields: { project: 'A项目' }
      };
      
      const indexedText = `1. 公司正在进行多个项目。
2. 项目管理部门负责协调。`;
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: false,
          reason: '索引文本中没有足够信息判断"项目A"和"A项目"是否为同一项目',
          confidence: 0.5,
          evidence_indices: []
        })
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.confidence).toBeLessThanOrEqual(0.6);
      expect(result.reason).toContain('没有足够信息');
    });
    
    it('should prioritize indexed text evidence over entity attributes', async () => {
      // Entity attributes suggest they're different, but indexed text says they're the same
      const entity1 = {
        entity_id: 'entity_1',
        canonical_name: 'ABC公司',
        entity_type: 'Organization',
        anchor_fields: { organization: 'ABC公司' },
        fields: { registration_number: '12345' }
      };
      
      const entity2 = {
        entity_id: 'entity_2',
        canonical_name: 'ABC科技有限公司',
        entity_type: 'Organization',
        anchor_fields: { organization: 'ABC科技有限公司' },
        fields: { registration_number: '67890' }
      };
      
      const indexedText = `1. ABC公司于2020年更名为ABC科技有限公司。
2. 更名后注册号从12345变更为67890。
3. 这是同一家公司的不同时期名称。`;
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          should_merge: true,
          reason: '索引文本第1和第3条明确表明这是同一公司的更名，应该合并',
          confidence: 0.95,
          evidence_indices: [1, 2, 3]
        })
      });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.shouldMerge).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reason).toContain('更名');
    });
    
    it('should handle retry logic on transient failures', async () => {
      const entity1 = { entity_id: 'entity_1', name: 'Entity 1' };
      const entity2 = { entity_id: 'entity_2', name: 'Entity 2' };
      const indexedText = '1. Some text';
      
      // First call fails, second succeeds
      mockLLMClient.chat
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            should_merge: true,
            reason: 'test',
            confidence: 0.8
          })
        });
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.validated).toBe(true);
      expect(result.shouldMerge).toBe(true);
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });
    
    it('should fail after max retries on persistent failures', async () => {
      const entity1 = { entity_id: 'entity_1', name: 'Entity 1' };
      const entity2 = { entity_id: 'entity_2', name: 'Entity 2' };
      const indexedText = '1. Some text';
      
      mockLLMClient.chat.mockRejectedValue(new Error('Persistent error'));
      
      const result = await validator.validateMergeDecision(
        entity1,
        entity2,
        indexedText,
        mockLLMClient
      );
      
      expect(result.validated).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2); // maxRetries = 2
    });
  });
});
