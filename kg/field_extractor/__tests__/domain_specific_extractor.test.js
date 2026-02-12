/**
 * Tests for domain-specific field extraction
 */

const {
  extractDomainSpecificFields,
  extractProjectDomainFields,
  extractBusinessDomainFields,
  extractGovernmentDomainFields
} = require('../rule_extractor');

describe('Domain-Specific Field Extraction', () => {
  describe('extractProjectDomainFields', () => {
    test('should extract project name', () => {
      const text = '2023年海南省海口市智慧城市建设项目';
      const fields = extractProjectDomainFields(text);
      
      const projectName = fields.find(f => f.name === '项目名称');
      expect(projectName).toBeDefined();
      expect(projectName.value).toContain('智慧城市建设项目');
      expect(projectName.domain).toBe('project');
    });
    
    test('should extract project location', () => {
      const text = '项目地点：海南省海口市龙华区';
      const fields = extractProjectDomainFields(text);
      
      const location = fields.find(f => f.name === '地点');
      expect(location).toBeDefined();
      expect(location.value).toContain('海南省海口市龙华区');
      expect(location.domain).toBe('project');
    });
    
    test('should extract execution unit', () => {
      const text = '执行单位：上海商汤智能科技有限公司';
      const fields = extractProjectDomainFields(text);
      
      const unit = fields.find(f => f.name === '执行单位');
      expect(unit).toBeDefined();
      expect(unit.value).toBe('上海商汤智能科技有限公司');
      expect(unit.domain).toBe('project');
    });
    
    test('should extract project budget', () => {
      const text = '项目预算：500万元';
      const fields = extractProjectDomainFields(text);
      
      const budget = fields.find(f => f.name === '预算');
      expect(budget).toBeDefined();
      expect(budget.value).toBe('500万元');
      expect(budget.domain).toBe('project');
    });
  });
  
  describe('extractBusinessDomainFields', () => {
    test('should extract company names', () => {
      const text = '甲方：北京科技有限公司，乙方：上海商贸集团';
      const fields = extractBusinessDomainFields(text);
      
      const companies = fields.filter(f => f.name === '公司');
      expect(companies.length).toBeGreaterThan(0);
      expect(companies[0].domain).toBe('business');
    });
    
    test('should extract contract number', () => {
      const text = '合同编号：HT-2023-001';
      const fields = extractBusinessDomainFields(text);
      
      const contractNo = fields.find(f => f.name === '合同编号');
      expect(contractNo).toBeDefined();
      expect(contractNo.value).toBe('HT-2023-001');
      expect(contractNo.domain).toBe('business');
    });
    
    test('should extract contract amount', () => {
      const text = '合同金额：1000万元';
      const fields = extractBusinessDomainFields(text);
      
      const amount = fields.find(f => f.name === '金额');
      expect(amount).toBeDefined();
      expect(amount.value).toBe('1000万元');
      expect(amount.domain).toBe('business');
    });
    
    test('should extract contract date', () => {
      const text = '签订日期：2023年12月15日';
      const fields = extractBusinessDomainFields(text);
      
      const date = fields.find(f => f.name === '日期');
      expect(date).toBeDefined();
      expect(date.domain).toBe('business');
    });
  });
  
  describe('extractGovernmentDomainFields', () => {
    test('should extract government agency', () => {
      const text = '海南省人民政府办公厅';
      const fields = extractGovernmentDomainFields(text);
      
      const agency = fields.find(f => f.name === '政府机构');
      expect(agency).toBeDefined();
      expect(agency.value).toContain('人民政府');
      expect(agency.domain).toBe('government');
    });
    
    test('should extract government department', () => {
      const text = '发文单位：海南省教育厅';
      const fields = extractGovernmentDomainFields(text);
      
      const dept = fields.find(f => f.name === '发文单位');
      expect(dept).toBeDefined();
      expect(dept.value).toContain('教育厅');
      expect(dept.domain).toBe('government');
    });
    
    test('should extract policy name', () => {
      const text = '海南省数字经济发展实施方案';
      const fields = extractGovernmentDomainFields(text);
      
      const policy = fields.find(f => f.name === '政策');
      expect(policy).toBeDefined();
      expect(policy.value).toContain('实施方案');
      expect(policy.domain).toBe('government');
    });
    
    test('should extract document number', () => {
      const text = '文号：琼府〔2023〕15号';
      const fields = extractGovernmentDomainFields(text);
      
      const docNo = fields.find(f => f.name === '文号');
      expect(docNo).toBeDefined();
      expect(docNo.domain).toBe('government');
    });
    
    test('should extract implementation date', () => {
      const text = '实施日期：2023年1月1日';
      const fields = extractGovernmentDomainFields(text);
      
      const date = fields.find(f => f.name === '实施日期');
      expect(date).toBeDefined();
      expect(date.domain).toBe('government');
    });
  });
  
  describe('extractDomainSpecificFields', () => {
    test('should route to project domain extractor', () => {
      const text = '2023年智慧城市建设项目';
      const fields = extractDomainSpecificFields(text, 'project');
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some(f => f.domain === 'project')).toBe(true);
    });
    
    test('should route to business domain extractor', () => {
      const text = '合同编号：HT-2023-001';
      const fields = extractDomainSpecificFields(text, 'business');
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some(f => f.domain === 'business')).toBe(true);
    });
    
    test('should route to government domain extractor', () => {
      const text = '海南省人民政府办公厅';
      const fields = extractDomainSpecificFields(text, 'government');
      
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some(f => f.domain === 'government')).toBe(true);
    });
    
    test('should return empty array for unknown domain', () => {
      const text = 'Some text';
      const fields = extractDomainSpecificFields(text, 'unknown');
      
      expect(fields).toEqual([]);
    });
  });
});
