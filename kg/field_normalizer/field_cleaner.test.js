/**
 * Field Cleaner Tests
 * 
 * Tests for field value cleaning and standardization functionality.
 */

const fieldCleaner = require('./field_cleaner');

describe('Field Cleaner', () => {
  describe('cleanFieldValue', () => {
    test('should clean time field', () => {
      const field = {
        name: '时间',
        value: '2025年 1月',
        type: 'time',
        confidence: 0.95
      };
      
      const cleaned = fieldCleaner.cleanFieldValue(field);
      
      expect(cleaned.value).toBe('2025-01');
      expect(cleaned.cleaned).toBe(true);
    });
    
    test('should clean number field', () => {
      const field = {
        name: '数值',
        value: '1,234.56',
        type: 'number',
        confidence: 0.95
      };
      
      const cleaned = fieldCleaner.cleanFieldValue(field);
      
      expect(cleaned.value).toBe('1234.56');
      expect(cleaned.cleaned).toBe(true);
    });
    
    test('should clean location field', () => {
      const field = {
        name: '区域',
        value: '阿里 C 区',
        type: 'location',
        confidence: 0.95
      };
      
      const cleaned = fieldCleaner.cleanFieldValue(field);
      
      expect(cleaned.value).toBe('阿里C区');
      expect(cleaned.cleaned).toBe(true);
    });
    
    test('should handle non-string values', () => {
      const field = {
        name: '数值',
        value: 123,
        type: 'number',
        confidence: 0.95
      };
      
      const cleaned = fieldCleaner.cleanFieldValue(field);
      
      expect(cleaned).toEqual(field);
    });
  });
  
  describe('removeNoiseFromValue', () => {
    test('should remove extra whitespace', () => {
      const value = '  阿里C区   2025年  ';
      const cleaned = fieldCleaner.removeNoiseFromValue(value);
      
      expect(cleaned).toBe('阿里C区 2025年');
    });
    
    test('should remove control characters', () => {
      const value = '阿里C区\x00\x1F';
      const cleaned = fieldCleaner.removeNoiseFromValue(value);
      
      expect(cleaned).toBe('阿里C区');
    });
    
    test('should remove zero-width characters', () => {
      const value = '阿里\u200BC区';
      const cleaned = fieldCleaner.removeNoiseFromValue(value);
      
      expect(cleaned).toBe('阿里C区');
    });
  });
  
  describe('standardizeTime', () => {
    test('should convert Chinese date format', () => {
      expect(fieldCleaner.standardizeTime('2025年1月')).toBe('2025-01');
      expect(fieldCleaner.standardizeTime('2025年1月26日')).toBe('2025-01-26');
      expect(fieldCleaner.standardizeTime('2025年 1月 26日')).toBe('2025-01-26');
    });
    
    test('should convert slash format', () => {
      expect(fieldCleaner.standardizeTime('2025/01/26')).toBe('2025-01-26');
      expect(fieldCleaner.standardizeTime('2025/1/26')).toBe('2025-01-26');
      expect(fieldCleaner.standardizeTime('2025/01/26 10:30')).toBe('2025-01-26T10:30:00');
      expect(fieldCleaner.standardizeTime('2025/01/26 10:30:45')).toBe('2025-01-26T10:30:45');
    });
    
    test('should convert dot format', () => {
      expect(fieldCleaner.standardizeTime('2025.01.26')).toBe('2025-01-26');
      expect(fieldCleaner.standardizeTime('2025.1.26')).toBe('2025-01-26');
      expect(fieldCleaner.standardizeTime('2025.01.26 10:30')).toBe('2025-01-26T10:30:00');
    });
    
    test('should convert dash format with time', () => {
      expect(fieldCleaner.standardizeTime('2025-01-26 10:30:00')).toBe('2025-01-26T10:30:00');
      expect(fieldCleaner.standardizeTime('2025-1-26 10:30')).toBe('2025-01-26T10:30:00');
    });
    
    test('should standardize year-month format', () => {
      expect(fieldCleaner.standardizeTime('2025-1')).toBe('2025-01');
      expect(fieldCleaner.standardizeTime('2025-12')).toBe('2025-12');
    });
    
    test('should handle relative time', () => {
      const result = fieldCleaner.standardizeTime('3天前');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    
    test('should keep ISO format unchanged', () => {
      expect(fieldCleaner.standardizeTime('2025-01-26')).toBe('2025-01-26');
      expect(fieldCleaner.standardizeTime('2025-01-26T10:30:00')).toBe('2025-01-26T10:30:00');
    });
  });
  
  describe('standardizeNumber', () => {
    test('should remove thousand separators', () => {
      expect(fieldCleaner.standardizeNumber('1,234')).toBe('1234');
      expect(fieldCleaner.standardizeNumber('1,234,567')).toBe('1234567');
      expect(fieldCleaner.standardizeNumber('1,234.56')).toBe('1234.56');
    });
    
    test('should remove spaces', () => {
      expect(fieldCleaner.standardizeNumber('1 234')).toBe('1234');
      expect(fieldCleaner.standardizeNumber('1 234.56')).toBe('1234.56');
    });
    
    test('should handle European format', () => {
      expect(fieldCleaner.standardizeNumber('1.234,56')).toBe('1234.56');
      expect(fieldCleaner.standardizeNumber('1.234.567,89')).toBe('1234567.89');
    });
    
    test('should handle negative numbers', () => {
      expect(fieldCleaner.standardizeNumber('-123.45')).toBe('-123.45');
      expect(fieldCleaner.standardizeNumber('- 123.45')).toBe('-123.45');
    });
    
    test('should remove trailing zeros', () => {
      expect(fieldCleaner.standardizeNumber('123.00')).toBe('123');
      expect(fieldCleaner.standardizeNumber('123.450')).toBe('123.45');
    });
    
    test('should keep valid numbers unchanged', () => {
      expect(fieldCleaner.standardizeNumber('123')).toBe('123');
      expect(fieldCleaner.standardizeNumber('123.45')).toBe('123.45');
    });
  });
  
  describe('standardizeUnit', () => {
    test('should standardize length units', () => {
      expect(fieldCleaner.standardizeUnit('公里')).toBe('km');
      expect(fieldCleaner.standardizeUnit('千米')).toBe('km');
      expect(fieldCleaner.standardizeUnit('米')).toBe('m');
      expect(fieldCleaner.standardizeUnit('厘米')).toBe('cm');
    });
    
    test('should standardize weight units', () => {
      expect(fieldCleaner.standardizeUnit('吨')).toBe('t');
      expect(fieldCleaner.standardizeUnit('公斤')).toBe('kg');
      expect(fieldCleaner.standardizeUnit('千克')).toBe('kg');
      expect(fieldCleaner.standardizeUnit('克')).toBe('g');
    });
    
    test('should standardize time units', () => {
      expect(fieldCleaner.standardizeUnit('年')).toBe('year');
      expect(fieldCleaner.standardizeUnit('月')).toBe('month');
      expect(fieldCleaner.standardizeUnit('天')).toBe('day');
      expect(fieldCleaner.standardizeUnit('小时')).toBe('hour');
    });
    
    test('should standardize currency units', () => {
      expect(fieldCleaner.standardizeUnit('元')).toBe('CNY');
      expect(fieldCleaner.standardizeUnit('人民币')).toBe('CNY');
      expect(fieldCleaner.standardizeUnit('美元')).toBe('USD');
    });
    
    test('should keep unknown units unchanged', () => {
      expect(fieldCleaner.standardizeUnit('unknown')).toBe('unknown');
    });
  });
  
  describe('standardizeLocation', () => {
    test('should remove extra whitespace', () => {
      expect(fieldCleaner.standardizeLocation('阿里 C 区')).toBe('阿里C区');
      expect(fieldCleaner.standardizeLocation('北京市 海淀区')).toBe('北京市海淀区');
    });
    
    test('should remove redundant suffixes', () => {
      expect(fieldCleaner.standardizeLocation('阿里C区地区')).toBe('阿里C区');
      expect(fieldCleaner.standardizeLocation('北京市区域')).toBe('北京市');
    });
  });
  
  describe('standardizeText', () => {
    test('should remove extra whitespace', () => {
      expect(fieldCleaner.standardizeText('  测试  文本  ')).toBe('测试 文本');
    });
    
    test('should remove special characters', () => {
      const text = '测试@#$文本';
      const cleaned = fieldCleaner.standardizeText(text);
      expect(cleaned).toBe('测试文本');
    });
    
    test('should normalize Chinese punctuation', () => {
      expect(fieldCleaner.standardizeText('测试，文本。')).toBe('测试,文本.');
      expect(fieldCleaner.standardizeText('测试；文本：')).toBe('测试;文本:');
      expect(fieldCleaner.standardizeText('测试！文本？')).toBe('测试!文本?');
      expect(fieldCleaner.standardizeText('测试（文本）')).toBe('测试(文本)');
    });
    
    test('should keep basic punctuation', () => {
      const text = '测试,文本.';
      const cleaned = fieldCleaner.standardizeText(text);
      expect(cleaned).toBe('测试,文本.');
    });
  });
  
  describe('batchCleanFields', () => {
    test('should clean multiple fields', () => {
      const fields = [
        { name: '时间', value: '2025年1月', type: 'time', confidence: 0.95 },
        { name: '数值', value: '1,234.56', type: 'number', confidence: 0.95 },
        { name: '区域', value: '阿里 C 区', type: 'location', confidence: 0.95 }
      ];
      
      const cleaned = fieldCleaner.batchCleanFields(fields);
      
      expect(cleaned).toHaveLength(3);
      expect(cleaned[0].value).toBe('2025-01');
      expect(cleaned[1].value).toBe('1234.56');
      expect(cleaned[2].value).toBe('阿里C区');
    });
    
    test('should throw error for non-array input', () => {
      expect(() => {
        fieldCleaner.batchCleanFields('not an array');
      }).toThrow('fields must be an array');
    });
  });
  
  describe('validateCleanedValue', () => {
    test('should validate time field', () => {
      const field = { value: '2025-01-26', type: 'time' };
      const validation = fieldCleaner.validateCleanedValue(field);
      
      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeNull();
    });
    
    test('should reject invalid time format', () => {
      const field = { value: '2025/01/26', type: 'time' };
      const validation = fieldCleaner.validateCleanedValue(field);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Invalid time format');
    });
    
    test('should validate number field', () => {
      const field = { value: '1234.56', type: 'number' };
      const validation = fieldCleaner.validateCleanedValue(field);
      
      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeNull();
    });
    
    test('should reject invalid number format', () => {
      const field = { value: '1,234.56', type: 'number' };
      const validation = fieldCleaner.validateCleanedValue(field);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Invalid number format');
    });
    
    test('should validate generic field', () => {
      const field = { value: '测试文本', type: 'text' };
      const validation = fieldCleaner.validateCleanedValue(field);
      
      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeNull();
    });
    
    test('should reject empty value', () => {
      const field = { value: '', type: 'text' };
      const validation = fieldCleaner.validateCleanedValue(field);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Empty value');
    });
  });
});
