/**
 * LLM Field Extractor Tests
 * 
 * Comprehensive unit tests covering:
 * - Batch prompt building
 * - Response parsing (JSON and markdown-wrapped)
 * - Field type inference
 * - Batch creation
 * - Statistics calculation
 * - Error handling
 * - Concurrency control
 * - Timeout control
 * - Retry logic
 */

const LLMFieldExtractor = require('../llm_extractor');

describe('LLMFieldExtractor', () => {
  let extractor;
  let mockLLMClient;
  
  beforeEach(() => {
    extractor = new LLMFieldExtractor({
      batchSize: 2,
      maxConcurrent: 1,
      temperature: 0.1,
      timeout: 5000,
      maxRetries: 2
    });
    
    mockLLMClient = {
      call: jest.fn()
    };
  });
  
  describe('_buildBatchPrompt', () => {
    it('should build correct batch prompt', () => {
      const batch = [
        {
          ckb: {
            ckb_id: 'ckb_1',
            content: { text: '海南省海口市美兰机场项目' }
          },
          missingFields: [
            { name: '地点' },
            { name: '执行单位' }
          ]
        },
        {
          ckb: {
            ckb_id: 'ckb_2',
            content: { text: '上海商汤智能科技有限公司' }
          },
          missingFields: [
            { name: '执行单位' }
          ]
        }
      ];
      
      const prompt = extractor._buildBatchPrompt(batch);
      
      expect(prompt).toContain('CKB 0');
      expect(prompt).toContain('CKB 1');
      expect(prompt).toContain('海南省海口市美兰机场项目');
      expect(prompt).toContain('上海商汤智能科技有限公司');
      expect(prompt).toContain('地点、执行单位');
      expect(prompt).toContain('执行单位');
      expect(prompt).toContain('JSON');
    });
    
    it('should truncate long text to reduce token consumption', () => {
      const longText = 'a'.repeat(200);
      const batch = [
        {
          ckb: {
            ckb_id: 'ckb_1',
            content: { text: longText }
          },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const prompt = extractor._buildBatchPrompt(batch);
      
      // Should truncate to 100 chars + '...'
      expect(prompt).toContain('...');
      expect(prompt.indexOf(longText)).toBe(-1);
    });
    
    it('should handle empty content gracefully', () => {
      const batch = [
        {
          ckb: {
            ckb_id: 'ckb_1',
            content: {}
          },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const prompt = extractor._buildBatchPrompt(batch);
      
      expect(prompt).toContain('CKB 0');
      expect(prompt).toContain('地点');
    });
  });
  
  describe('_parseBatchResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        ckb_0: [
          { name: '地点', value: '海南省海口市', confidence: 0.9 },
          { name: '执行单位', value: '上海商汤智能科技', confidence: 0.95 }
        ],
        ckb_1: [
          { name: '执行单位', value: null, confidence: 0 }
        ]
      });
      
      const batch = [
        { ckb: { ckb_id: 'ckb_1' }, missingFields: [] },
        { ckb: { ckb_id: 'ckb_2' }, missingFields: [] }
      ];
      
      const results = extractor._parseBatchResponse(response, batch);
      
      expect(results.size).toBe(1); // Only ckb_1 has valid fields
      expect(results.get('ckb_1')).toHaveLength(2);
      expect(results.get('ckb_1')[0].name).toBe('地点');
      expect(results.get('ckb_1')[0].value).toBe('海南省海口市');
      expect(results.get('ckb_1')[0].sources).toContain('llm');
    });
    
    it('should handle markdown-wrapped JSON', () => {
      const response = '```json\n' + JSON.stringify({
        ckb_0: [
          { name: '地点', value: '海南省海口市', confidence: 0.9 }
        ]
      }) + '\n```';
      
      const batch = [
        { ckb: { ckb_id: 'ckb_1' }, missingFields: [] }
      ];
      
      const results = extractor._parseBatchResponse(response, batch);
      
      expect(results.size).toBe(1);
      expect(results.get('ckb_1')).toHaveLength(1);
    });
    
    it('should handle markdown without json tag', () => {
      const response = '```\n' + JSON.stringify({
        ckb_0: [
          { name: '地点', value: '海南省海口市', confidence: 0.9 }
        ]
      }) + '\n```';
      
      const batch = [
        { ckb: { ckb_id: 'ckb_1' }, missingFields: [] }
      ];
      
      const results = extractor._parseBatchResponse(response, batch);
      
      expect(results.size).toBe(1);
      expect(results.get('ckb_1')).toHaveLength(1);
    });
    
    it('should filter out null values', () => {
      const response = JSON.stringify({
        ckb_0: [
          { name: '地点', value: '海南省海口市', confidence: 0.9 },
          { name: '执行单位', value: null, confidence: 0 },
          { name: '负责单位', value: '', confidence: 0 }
        ]
      });
      
      const batch = [
        { ckb: { ckb_id: 'ckb_1' }, missingFields: [] }
      ];
      
      const results = extractor._parseBatchResponse(response, batch);
      
      expect(results.get('ckb_1')).toHaveLength(1);
      expect(results.get('ckb_1')[0].name).toBe('地点');
    });
    
    it('should handle invalid JSON gracefully', () => {
      const response = 'This is not valid JSON';
      const batch = [
        { ckb: { ckb_id: 'ckb_1' }, missingFields: [] }
      ];
      
      const results = extractor._parseBatchResponse(response, batch);
      
      expect(results.size).toBe(0);
    });
    
    it('should attempt to fix JSON with trailing commas', () => {
      const response = '{"ckb_0": [{"name": "地点", "value": "海口市", "confidence": 0.9,}],}';
      const batch = [
        { ckb: { ckb_id: 'ckb_1' }, missingFields: [] }
      ];
      
      const results = extractor._parseBatchResponse(response, batch);
      
      expect(results.size).toBe(1);
      expect(results.get('ckb_1')).toHaveLength(1);
    });
    
    it('should set default confidence when not provided', () => {
      const response = JSON.stringify({
        ckb_0: [
          { name: '地点', value: '海南省海口市' }
        ]
      });
      
      const batch = [
        { ckb: { ckb_id: 'ckb_1' }, missingFields: [] }
      ];
      
      const results = extractor._parseBatchResponse(response, batch);
      
      expect(results.get('ckb_1')[0].confidence).toBe(0.8);
    });
  });
  
  describe('_inferFieldType', () => {
    it('should infer location type', () => {
      expect(extractor._inferFieldType('地点')).toBe('location');
      expect(extractor._inferFieldType('位置')).toBe('location');
      expect(extractor._inferFieldType('区域')).toBe('location');
    });
    
    it('should infer entity type', () => {
      expect(extractor._inferFieldType('执行单位')).toBe('entity');
      expect(extractor._inferFieldType('公司')).toBe('entity');
      expect(extractor._inferFieldType('组织')).toBe('entity');
    });
    
    it('should infer time type', () => {
      expect(extractor._inferFieldType('时间')).toBe('time');
      expect(extractor._inferFieldType('日期')).toBe('time');
    });
    
    it('should infer number type', () => {
      expect(extractor._inferFieldType('数值')).toBe('number');
      expect(extractor._inferFieldType('金额')).toBe('number');
      expect(extractor._inferFieldType('数量')).toBe('number');
    });
    
    it('should default to text type', () => {
      expect(extractor._inferFieldType('其他字段')).toBe('text');
      expect(extractor._inferFieldType('描述')).toBe('text');
    });
  });
  
  describe('_createBatches', () => {
    it('should create correct batches', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const batches = extractor._createBatches(items, 3);
      
      expect(batches).toHaveLength(3);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7]);
    });
    
    it('should handle empty array', () => {
      const batches = extractor._createBatches([], 3);
      expect(batches).toHaveLength(0);
    });
    
    it('should handle single item', () => {
      const batches = extractor._createBatches([1], 3);
      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual([1]);
    });
    
    it('should handle exact batch size', () => {
      const items = [1, 2, 3, 4, 5, 6];
      const batches = extractor._createBatches(items, 3);
      expect(batches).toHaveLength(2);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
    });
  });
  
  describe('getStats', () => {
    it('should calculate correct statistics', () => {
      const results = new Map();
      results.set('ckb_1', [
        { name: '地点', value: '海口市' },
        { name: '执行单位', value: '商汤科技' }
      ]);
      results.set('ckb_2', [
        { name: '地点', value: '上海市' }
      ]);
      
      const stats = extractor.getStats(results);
      
      expect(stats.ckbsProcessed).toBe(2);
      expect(stats.totalFields).toBe(3);
      expect(stats.avgFieldsPerCKB).toBe('1.50');
      expect(stats.fieldDistribution['地点']).toBe(2);
      expect(stats.fieldDistribution['执行单位']).toBe(1);
    });
    
    it('should handle empty results', () => {
      const results = new Map();
      const stats = extractor.getStats(results);
      
      expect(stats.ckbsProcessed).toBe(0);
      expect(stats.totalFields).toBe(0);
      expect(stats.avgFieldsPerCKB).toBe(0);
      expect(Object.keys(stats.fieldDistribution)).toHaveLength(0);
    });
    
    it('should handle single CKB', () => {
      const results = new Map();
      results.set('ckb_1', [
        { name: '地点', value: '海口市' }
      ]);
      
      const stats = extractor.getStats(results);
      
      expect(stats.ckbsProcessed).toBe(1);
      expect(stats.totalFields).toBe(1);
      expect(stats.avgFieldsPerCKB).toBe('1.00');
    });
  });
  
  describe('batchExtractMissingFields', () => {
    it('should return empty map when no CKBs provided', async () => {
      const results = await extractor.batchExtractMissingFields([], mockLLMClient);
      expect(results.size).toBe(0);
    });
    
    it('should return empty map when no LLM client provided', async () => {
      const ckbs = [{ ckb: {}, missingFields: [] }];
      const results = await extractor.batchExtractMissingFields(ckbs, null);
      expect(results.size).toBe(0);
    });
    
    it('should process batch successfully', async () => {
      mockLLMClient.call.mockResolvedValue({
        content: JSON.stringify({
          ckb_0: [
            { name: '地点', value: '海南省海口市', confidence: 0.9 }
          ]
        })
      });
      
      const ckbs = [
        {
          ckb: {
            ckb_id: 'ckb_1',
            content: { text: '海南省海口市美兰机场项目' }
          },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const results = await extractor.batchExtractMissingFields(ckbs, mockLLMClient);
      
      expect(results.size).toBe(1);
      expect(results.get('ckb_1')).toHaveLength(1);
      expect(results.get('ckb_1')[0].name).toBe('地点');
      expect(mockLLMClient.call).toHaveBeenCalledTimes(1);
    });
    
    it('should process multiple batches', async () => {
      mockLLMClient.call.mockResolvedValue({
        content: JSON.stringify({
          ckb_0: [{ name: '地点', value: '海口市', confidence: 0.9 }],
          ckb_1: [{ name: '地点', value: '上海市', confidence: 0.9 }]
        })
      });
      
      // Create 4 CKBs with batch size of 2
      const ckbs = [
        { ckb: { ckb_id: 'ckb_1', content: { text: 'text1' } }, missingFields: [{ name: '地点' }] },
        { ckb: { ckb_id: 'ckb_2', content: { text: 'text2' } }, missingFields: [{ name: '地点' }] },
        { ckb: { ckb_id: 'ckb_3', content: { text: 'text3' } }, missingFields: [{ name: '地点' }] },
        { ckb: { ckb_id: 'ckb_4', content: { text: 'text4' } }, missingFields: [{ name: '地点' }] }
      ];
      
      const results = await extractor.batchExtractMissingFields(ckbs, mockLLMClient);
      
      // Should call LLM twice (2 batches)
      expect(mockLLMClient.call).toHaveBeenCalledTimes(2);
      expect(results.size).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle LLM call failure with retry', async () => {
      // First call fails, second succeeds
      mockLLMClient.call
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            ckb_0: [{ name: '地点', value: '海口市', confidence: 0.9 }]
          })
        });
      
      const ckbs = [
        {
          ckb: { ckb_id: 'ckb_1', content: { text: 'text' } },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const results = await extractor.batchExtractMissingFields(ckbs, mockLLMClient);
      
      // Should retry and succeed
      expect(mockLLMClient.call).toHaveBeenCalledTimes(2);
      expect(results.size).toBe(1);
    });
    
    it('should fallback to individual processing when batch fails', async () => {
      // Batch call fails all retries, individual calls succeed
      mockLLMClient.call
        .mockRejectedValueOnce(new Error('Batch failed'))
        .mockRejectedValueOnce(new Error('Batch failed'))
        .mockResolvedValueOnce({
          content: JSON.stringify([
            { name: '地点', value: '海口市', confidence: 0.9 }
          ])
        });
      
      const ckbs = [
        {
          ckb: { ckb_id: 'ckb_1', content: { text: 'text' } },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const results = await extractor.batchExtractMissingFields(ckbs, mockLLMClient);
      
      // Should try batch twice, then fallback to individual
      expect(mockLLMClient.call).toHaveBeenCalledTimes(3);
    });
    
    it('should handle parse errors gracefully', async () => {
      mockLLMClient.call.mockResolvedValue({
        content: 'Invalid JSON response'
      });
      
      const ckbs = [
        {
          ckb: { ckb_id: 'ckb_1', content: { text: 'text' } },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const results = await extractor.batchExtractMissingFields(ckbs, mockLLMClient);
      
      // Should handle gracefully and attempt fallback
      expect(results.size).toBe(0);
    });
    
    it('should handle individual extraction failure', async () => {
      const result = await extractor.extractMissingFields(
        { ckb_id: 'ckb_1', content: { text: 'text' } },
        [{ name: '地点' }],
        {
          call: jest.fn().mockRejectedValue(new Error('Failed'))
        }
      );
      
      expect(result).toEqual([]);
    });
  });
  
  describe('Retry Logic', () => {
    it('should retry with exponential backoff', async () => {
      const startTime = Date.now();
      
      mockLLMClient.call
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            ckb_0: [{ name: '地点', value: '海口市', confidence: 0.9 }]
          })
        });
      
      const ckbs = [
        {
          ckb: { ckb_id: 'ckb_1', content: { text: 'text' } },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      await extractor.batchExtractMissingFields(ckbs, mockLLMClient);
      
      const duration = Date.now() - startTime;
      
      // Should have waited at least 1000ms for exponential backoff
      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(mockLLMClient.call).toHaveBeenCalledTimes(2);
    });
    
    it('should fail after max retries', async () => {
      mockLLMClient.call.mockRejectedValue(new Error('Persistent error'));
      
      const ckbs = [
        {
          ckb: { ckb_id: 'ckb_1', content: { text: 'text' } },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const results = await extractor.batchExtractMissingFields(ckbs, mockLLMClient);
      
      // Should try maxRetries times for batch, then fallback which also fails
      expect(mockLLMClient.call.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(results.size).toBe(0);
    });
  });
  
  describe('Timeout Control', () => {
    it('should handle timeout errors from p-queue', async () => {
      // Test that the extractor handles timeout errors gracefully
      // The actual timeout is controlled by p-queue, so we just verify error handling
      const timeoutClient = {
        call: jest.fn().mockRejectedValue(new Error('TimeoutError'))
      };
      
      const ckbs = [
        {
          ckb: { ckb_id: 'ckb_1', content: { text: 'text' } },
          missingFields: [{ name: '地点' }]
        }
      ];
      
      const results = await extractor.batchExtractMissingFields(ckbs, timeoutClient);
      
      // Should handle timeout error and return empty results
      expect(results.size).toBe(0);
    });
  });
  
  describe('Concurrency Control', () => {
    it('should respect max concurrent limit', async () => {
      const concurrentExtractor = new LLMFieldExtractor({
        batchSize: 1,
        maxConcurrent: 2,
        maxRetries: 1
      });
      
      let activeCalls = 0;
      let maxActiveCalls = 0;
      
      const trackingClient = {
        call: jest.fn().mockImplementation(async () => {
          activeCalls++;
          maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          activeCalls--;
          return {
            content: JSON.stringify({
              ckb_0: [{ name: '地点', value: '海口市', confidence: 0.9 }]
            })
          };
        })
      };
      
      // Create 5 CKBs to test concurrency
      const ckbs = Array.from({ length: 5 }, (_, i) => ({
        ckb: { ckb_id: `ckb_${i}`, content: { text: `text${i}` } },
        missingFields: [{ name: '地点' }]
      }));
      
      await concurrentExtractor.batchExtractMissingFields(ckbs, trackingClient);
      
      // Should never exceed max concurrent limit
      expect(maxActiveCalls).toBeLessThanOrEqual(2);
    });
  });
  
  describe('extractMissingFields (single CKB)', () => {
    it('should extract fields for single CKB', async () => {
      mockLLMClient.call.mockResolvedValue({
        content: JSON.stringify([
          { name: '地点', value: '海南省海口市', confidence: 0.9 },
          { name: '执行单位', value: '商汤科技', confidence: 0.95 }
        ])
      });
      
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '海南省海口市美兰机场项目由商汤科技执行' }
      };
      
      const missingFields = [
        { name: '地点' },
        { name: '执行单位' }
      ];
      
      const fields = await extractor.extractMissingFields(ckb, missingFields, mockLLMClient);
      
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('地点');
      expect(fields[0].value).toBe('海南省海口市');
      expect(fields[0].sources).toContain('llm');
      expect(fields[1].name).toBe('执行单位');
    });
    
    it('should handle markdown-wrapped response', async () => {
      mockLLMClient.call.mockResolvedValue({
        content: '```json\n' + JSON.stringify([
          { name: '地点', value: '海南省海口市', confidence: 0.9 }
        ]) + '\n```'
      });
      
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '海南省海口市美兰机场项目' }
      };
      
      const fields = await extractor.extractMissingFields(ckb, [{ name: '地点' }], mockLLMClient);
      
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('地点');
    });
    
    it('should filter null values', async () => {
      mockLLMClient.call.mockResolvedValue({
        content: JSON.stringify([
          { name: '地点', value: '海南省海口市', confidence: 0.9 },
          { name: '执行单位', value: null, confidence: 0 }
        ])
      });
      
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '海南省海口市美兰机场项目' }
      };
      
      const fields = await extractor.extractMissingFields(ckb, [{ name: '地点' }, { name: '执行单位' }], mockLLMClient);
      
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('地点');
    });
  });
});
