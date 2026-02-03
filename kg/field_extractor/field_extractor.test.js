/**
 * Field Extractor Unit Tests
 */

const ruleExtractor = require('./rule_extractor');
const nerExtractor = require('./ner_extractor');
const fieldExtractor = require('./field_extractor');

describe('Rule Extractor', () => {
  describe('Time Field Extraction', () => {
    test('should extract YYYY年MM月DD日 format', () => {
      const text = '2025年1月15日发生了重要事件';
      const fields = ruleExtractor.extractTimeFields(text);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].value).toBe('2025-01-15');
      expect(fields[0].type).toBe('time');
      expect(fields[0].confidence).toBe(1.0);
    });
    
    test('should extract YYYY年MM月 format', () => {
      const text = '2025年1月的数据统计';
      const fields = ruleExtractor.extractTimeFields(text);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].value).toBe('2025-01');
    });
    
    test('should extract YYYY-MM-DD format', () => {
      const text = '报告日期：2025-01-15';
      const fields = ruleExtractor.extractTimeFields(text);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].value).toBe('2025-01-15');
    });
  });
  
  describe('Number and Unit Extraction', () => {
    test('should extract number with unit', () => {
      const text = '水位下降了10米';
      const fields = ruleExtractor.extractNumberFields(text);
      
      const numberField = fields.find(f => f.type === 'number');
      const unitField = fields.find(f => f.type === 'unit');
      
      expect(numberField).toBeDefined();
      expect(numberField.value).toBe('10');
      expect(unitField).toBeDefined();
      expect(unitField.value).toBe('米');
    });
    
    test('should extract decimal numbers', () => {
      const text = '温度为25.5摄氏度';
      const fields = ruleExtractor.extractNumberFields(text);
      
      const numberField = fields.find(f => f.type === 'number');
      expect(numberField).toBeDefined();
      expect(numberField.value).toBe('25.5');
    });
    
    test('should extract multiple number-unit pairs', () => {
      const text = '长度10米，宽度5米，高度3米';
      const fields = ruleExtractor.extractNumberFields(text);
      
      const numberFields = fields.filter(f => f.type === 'number');
      expect(numberFields.length).toBe(3);
    });
  });
  
  describe('Location Extraction', () => {
    test('should extract location with 区', () => {
      const text = '阿里C区的水位监测';
      const fields = ruleExtractor.extractLocationFields(text);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].type).toBe('location');
      expect(fields[0].value).toContain('区');
    });
    
    test('should extract administrative divisions', () => {
      const text = '北京市海淀区中关村';
      const fields = ruleExtractor.extractLocationFields(text);
      
      expect(fields.length).toBeGreaterThan(0);
    });
  });
  
  describe('Indicator Extraction', () => {
    test('should extract common indicators', () => {
      const text = '水位、温度和湿度的监测数据';
      const fields = ruleExtractor.extractIndicatorFields(text);
      
      expect(fields.length).toBeGreaterThanOrEqual(3);
      expect(fields.some(f => f.value === '水位')).toBe(true);
      expect(fields.some(f => f.value === '温度')).toBe(true);
      expect(fields.some(f => f.value === '湿度')).toBe(true);
    });
  });
});

describe('NER Extractor', () => {
  describe('Organization Extraction', () => {
    test('should extract organizations', () => {
      const text = '阿里巴巴集团和腾讯公司达成合作';
      const entities = nerExtractor.extractOrganizations(text);
      
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some(e => e.value.includes('集团'))).toBe(true);
      expect(entities.some(e => e.value.includes('公司'))).toBe(true);
    });
  });
  
  describe('Person Extraction', () => {
    test('should extract persons with titles', () => {
      const text = '张教授和李博士进行了研究';
      const entities = nerExtractor.extractPersons(text);
      
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some(e => e.value.includes('教授'))).toBe(true);
    });
  });
});

describe('Field Extractor Integration', () => {
  test('should extract fields from complex text', async () => {
    const ckb = {
      ckb_id: 'test-ckb-001',
      content: {
        text: '阿里C区2025年1月水位下降10米，温度为25摄氏度'
      }
    };
    
    const fields = await fieldExtractor.extractFields(ckb, { useLLM: false });
    
    expect(fields.length).toBeGreaterThan(0);
    
    // Should have time field
    const timeFields = fields.filter(f => f.type === 'time');
    expect(timeFields.length).toBeGreaterThan(0);
    
    // Should have number fields
    const numberFields = fields.filter(f => f.type === 'number');
    expect(numberFields.length).toBeGreaterThan(0);
    
    // Should have location field
    const locationFields = fields.filter(f => f.type === 'location');
    expect(locationFields.length).toBeGreaterThan(0);
  });
  
  test('should get field statistics', async () => {
    const ckb = {
      ckb_id: 'test-ckb-002',
      content: {
        text: '2025年1月15日，北京市温度10摄氏度'
      }
    };
    
    const fields = await fieldExtractor.extractFields(ckb, { useLLM: false });
    const stats = fieldExtractor.getFieldStatistics(fields);
    
    expect(stats.total).toBe(fields.length);
    expect(stats.byType).toBeDefined();
    expect(stats.avgConfidence).toBeGreaterThan(0);
  });
  
  test('should filter fields by type', async () => {
    const ckb = {
      ckb_id: 'test-ckb-003',
      content: {
        text: '2025年1月水位10米'
      }
    };
    
    const fields = await fieldExtractor.extractFields(ckb, { useLLM: false });
    const timeFields = fieldExtractor.filterFieldsByType(fields, 'time');
    
    expect(timeFields.every(f => f.type === 'time')).toBe(true);
  });
  
  test('should filter fields by confidence', async () => {
    const ckb = {
      ckb_id: 'test-ckb-004',
      content: {
        text: '测试数据'
      }
    };
    
    const fields = await fieldExtractor.extractFields(ckb, { useLLM: false });
    const highConfidenceFields = fieldExtractor.filterFieldsByConfidence(fields, 0.8);
    
    expect(highConfidenceFields.every(f => f.confidence >= 0.8)).toBe(true);
  });
});
