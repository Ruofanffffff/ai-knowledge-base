/**
 * Rule Extractor - Required Fields Parameter Tests
 * Tests for task 2.1.1: Support receiving requiredFields parameter
 */

const ruleExtractor = require('../rule_extractor');

describe('Rule Extractor - Required Fields Parameter', () => {
  describe('extractFields with requiredFields parameter', () => {
    test('should accept requiredFields parameter', () => {
      const text = '海南省海口市的项目由上海商汤智能科技有限公司执行';
      const requiredFields = [
        { name: '地点', weight: 0.2, required: false, sources: [] },
        { name: '执行单位', weight: 0.3, required: true, sources: [] }
      ];
      
      const fields = ruleExtractor.extractFields(text, requiredFields);
      
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
    });
    
    test('should work without requiredFields parameter (backward compatibility)', () => {
      const text = '海南省海口市的项目';
      const fields = ruleExtractor.extractFields(text);
      
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
    });
    
    test('should extract targeted location fields when required', () => {
      const text = '项目位于海南省海口市龙华区';
      const requiredFields = [
        { name: '地点', weight: 0.5, required: true, sources: [{ schema: 'Project-Entity', type: 'relation' }] }
      ];
      
      const fields = ruleExtractor.extractFields(text, requiredFields);
      
      // Should have targeted location fields
      const targetedLocationFields = fields.filter(f => 
        f.name === '地点' && f.targetedExtraction === true
      );
      
      expect(targetedLocationFields.length).toBeGreaterThan(0);
      expect(targetedLocationFields[0].requiredField).toBe(true);
      expect(targetedLocationFields[0].weight).toBe(0.5);
    });
    
    test('should extract targeted organization fields when required', () => {
      const text = '项目由上海商汤智能科技有限公司执行';
      const requiredFields = [
        { name: '执行单位', weight: 0.4, required: true, sources: [{ schema: 'Project-Entity', type: 'core' }] }
      ];
      
      const fields = ruleExtractor.extractFields(text, requiredFields);
      
      // Should have targeted organization fields
      const targetedOrgFields = fields.filter(f => 
        f.name === '执行单位' && f.targetedExtraction === true
      );
      
      expect(targetedOrgFields.length).toBeGreaterThan(0);
      expect(targetedOrgFields[0].requiredField).toBe(true);
    });
    
    test('should extract targeted project name fields when required', () => {
      const text = '2024年海南省智慧城市建设项目正式启动';
      const requiredFields = [
        { name: '项目名称', weight: 0.6, required: true, sources: [] }
      ];
      
      const fields = ruleExtractor.extractFields(text, requiredFields);
      
      // Should have targeted project name fields
      const targetedProjectFields = fields.filter(f => 
        f.name === '项目名称' && f.targetedExtraction === true
      );
      
      expect(targetedProjectFields.length).toBeGreaterThan(0);
      expect(targetedProjectFields[0].value).toContain('建设');
    });
    
    test('should extract multiple required field types', () => {
      const text = '2024年海南省海口市智慧城市建设项目由海南省政府执行，预算金额5000万元';
      const requiredFields = [
        { name: '地点', weight: 0.3, required: false, sources: [] },
        { name: '执行单位', weight: 0.4, required: true, sources: [] },
        { name: '项目名称', weight: 0.5, required: true, sources: [] },
        { name: '金额', weight: 0.3, required: false, sources: [] }
      ];
      
      const fields = ruleExtractor.extractFields(text, requiredFields);
      
      // Should have targeted fields for each required field type
      const targetedFields = fields.filter(f => f.targetedExtraction === true);
      
      expect(targetedFields.length).toBeGreaterThan(0);
      
      // Check that we have fields for different types
      const fieldNames = new Set(targetedFields.map(f => f.name));
      expect(fieldNames.size).toBeGreaterThan(1);
    });
    
    test('should handle empty requiredFields array', () => {
      const text = '测试文本';
      const requiredFields = [];
      
      const fields = ruleExtractor.extractFields(text, requiredFields);
      
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
    });
    
    test('should handle null requiredFields', () => {
      const text = '测试文本';
      const requiredFields = null;
      
      const fields = ruleExtractor.extractFields(text, requiredFields);
      
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
    });
  });
  
  describe('extractTargetedFields', () => {
    test('should extract fields based on field name mapping', () => {
      const text = '项目位于北京市海淀区';
      const requiredFields = [
        { name: '位置', weight: 0.3, required: false, sources: [] }
      ];
      
      const fields = ruleExtractor.extractTargetedFields(text, requiredFields);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].name).toBe('位置');
    });
    
    test('should extract person names when required', () => {
      const text = '项目负责人：张三';
      const requiredFields = [
        { name: '负责人', weight: 0.4, required: true, sources: [] }
      ];
      
      const fields = ruleExtractor.extractTargetedFields(text, requiredFields);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].name).toBe('负责人');
    });
    
    test('should extract amounts when required', () => {
      const text = '项目预算金额：5000万元';
      const requiredFields = [
        { name: '金额', weight: 0.3, required: false, sources: [] }
      ];
      
      const fields = ruleExtractor.extractTargetedFields(text, requiredFields);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].name).toBe('金额');
      expect(fields[0].value).toContain('万元');
    });
  });
  
  describe('Helper extraction functions', () => {
    test('extractProjectNames should extract project names', () => {
      const text = '2024年智慧城市建设项目';
      const fields = ruleExtractor.extractProjectNames(text);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].value).toContain('项目');
    });
    
    test('extractPersonNames should extract person names', () => {
      const text = '负责人：李四';
      const fields = ruleExtractor.extractPersonNames(text);
      
      expect(fields.length).toBeGreaterThan(0);
    });
    
    test('extractAmounts should extract monetary amounts', () => {
      const text = '合同金额：3000万元';
      const fields = ruleExtractor.extractAmounts(text);
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0].value).toContain('万元');
    });
  });
});
