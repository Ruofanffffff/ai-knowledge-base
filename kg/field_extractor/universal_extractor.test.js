/**
 * Universal Extractor Tests
 */

const UniversalExtractor = require('./universal_extractor');

describe('UniversalExtractor', () => {
  let extractor;
  
  beforeEach(() => {
    extractor = new UniversalExtractor();
  });
  
  describe('结构化字段提取', () => {
    test('应该提取中文冒号格式的字段', async () => {
      const ckb = {
        ckb_id: 'test_001',
        doc_id: 'doc_001',
        content: {
          text: `
相机：Sony A7M4
镜头：35mm f1.8
ISO：3200
光圈：f1.8
快门速度：1/15s
          `
        }
      };
      
      const fields = await extractor.extractFields(ckb, {
        includeKeywords: false  // 只测试结构化提取
      });
      
      expect(fields.length).toBeGreaterThan(0);
      
      // 检查是否提取到相机字段
      const cameraField = fields.find(f => f.name === '相机');
      expect(cameraField).toBeDefined();
      expect(cameraField.value).toBe('Sony A7M4');
      expect(cameraField.extraction_method).toBe('structured');
      
      // 检查ISO字段
      const isoField = fields.find(f => f.name === 'ISO');
      expect(isoField).toBeDefined();
      expect(isoField.value).toBe('3200');
    });
    
    test('应该提取英文冒号格式的字段', async () => {
      const ckb = {
        ckb_id: 'test_002',
        doc_id: 'doc_002',
        content: {
          text: `
Camera: Sony A7M4
Lens: 35mm f1.8
ISO: 3200
          `
        }
      };
      
      const fields = await extractor.extractFields(ckb, {
        includeKeywords: false
      });
      
      expect(fields.length).toBeGreaterThan(0);
      
      const cameraField = fields.find(f => f.name === 'Camera');
      expect(cameraField).toBeDefined();
      expect(cameraField.value).toBe('Sony A7M4');
    });
    
    test('应该提取Markdown列表格式的字段', async () => {
      const ckb = {
        ckb_id: 'test_003',
        doc_id: 'doc_003',
        content: {
          text: `
- 相机：Sony A7M4
- 镜头：35mm f1.8
- ISO：3200
          `
        }
      };
      
      const fields = await extractor.extractFields(ckb, {
        includeKeywords: false
      });
      
      expect(fields.length).toBeGreaterThanOrEqual(3);  // 至少提取3个字段
    });
  });
  
  describe('值类型检测', () => {
    test('应该正确识别日期', () => {
      expect(extractor._detectValueType('2025-10-15')).toBe('date');
      expect(extractor._detectValueType('2025年10月15日')).toBe('date');
    });
    
    test('应该正确识别数字', () => {
      expect(extractor._detectValueType('3200')).toBe('number');
      expect(extractor._detectValueType('3.14')).toBe('number');
      expect(extractor._detectValueType('-10')).toBe('number');
    });
    
    test('应该正确识别百分比', () => {
      expect(extractor._detectValueType('85%')).toBe('percentage');
      expect(extractor._detectValueType('3.14%')).toBe('percentage');
    });
    
    test('应该正确识别URL', () => {
      expect(extractor._detectValueType('https://example.com')).toBe('url');
      expect(extractor._detectValueType('http://test.org')).toBe('url');
    });
    
    test('应该正确识别邮箱', () => {
      expect(extractor._detectValueType('test@example.com')).toBe('email');
    });
  });
  
  describe('去重', () => {
    test('应该去除重复字段', () => {
      const fields = [
        { name: '相机', value: 'Sony A7M4', confidence: 0.9 },
        { name: '相机', value: 'Sony A7M4', confidence: 0.8 },
        { name: '镜头', value: '35mm', confidence: 0.9 }
      ];
      
      const unique = extractor._deduplicateFields(fields);
      
      expect(unique.length).toBe(2);
      // 应该保留置信度更高的
      expect(unique.find(f => f.name === '相机').confidence).toBe(0.9);
    });
  });
  
  describe('统计信息', () => {
    test('应该返回正确的统计信息', () => {
      const fields = [
        { name: 'f1', value: 'v1', confidence: 0.9, extraction_method: 'structured', type: 'text' },
        { name: 'f2', value: 'v2', confidence: 0.8, extraction_method: 'structured', type: 'number' },
        { name: 'f3', value: 'v3', confidence: 0.7, extraction_method: 'keyword', type: 'text' }
      ];
      
      const stats = extractor.getStats(fields);
      
      expect(stats.total).toBe(3);
      expect(stats.byMethod.structured).toBe(2);
      expect(stats.byMethod.keyword).toBe(1);
      expect(stats.byType.text).toBe(2);
      expect(stats.byType.number).toBe(1);
      expect(stats.avgConfidence).toBeCloseTo(0.8, 1);  // 0.8 as decimal (0-1 range)
    });
  });
});
