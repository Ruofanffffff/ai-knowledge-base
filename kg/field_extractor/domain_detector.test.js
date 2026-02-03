/**
 * Unit Tests for Domain Detector
 */

const domainDetector = require('./domain_detector');

describe('Domain Detector', () => {
  describe('detectDomain', () => {
    test('should detect travel domain from travel keywords', () => {
      const ckb = {
        content: {
          text: '苏杭四日游，人均800多点，冬天去最合适。主要景点有西湖、乌镇西栅、南浔古镇。风景优美，古镇风情浓郁。建议坐高铁前往。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('travel');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.keywords.length).toBeGreaterThan(0);
      // Check that at least one travel keyword is present
      const travelKeywords = ['旅游', '景点', '攻略', '目的地', '行程', '导游', '住宿', '交通'];
      const hasKeyword = result.keywords.some(k => travelKeywords.includes(k));
      expect(hasKeyword).toBe(true);
      expect(result.executionTime).toBeLessThan(10); // Performance requirement
    });
    
    test('should detect medical domain from medical keywords', () => {
      const ckb = {
        content: {
          text: '病人在医院接受治疗，医生开具处方药物，进行诊断和检查。护士协助手术，病历记录完整。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('medical');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.keywords.length).toBeGreaterThan(0);
    });
    
    test('should detect government domain from government keywords', () => {
      const ckb = {
        content: {
          text: '政府发布新政策，行政部门负责审批和登记，公告通知已发布，相关文件需要备案。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('government');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    test('should detect legal domain from legal keywords', () => {
      const ckb = {
        content: {
          text: '律师代理诉讼案件，法院判决原告胜诉，被告需要赔偿。合同条款明确，仲裁协议有效。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('legal');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    test('should detect financial domain from financial keywords', () => {
      const ckb = {
        content: {
          text: '银行提供贷款服务，投资股票和基金，理财产品收益稳定，利率调整影响融资成本。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('financial');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    test('should default to general for empty content', () => {
      const ckb = {
        content: {
          text: ''
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('general');
      expect(result.confidence).toBe(1.0);
      expect(result.keywords).toEqual([]);
      expect(result.metadata.reason).toContain('Empty content');
    });
    
    test('should default to general for ambiguous content', () => {
      const ckb = {
        content: {
          text: '今天天气很好，我去公园散步，看到很多人在锻炼身体。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('general');
      expect(result.confidence).toBe(1.0);
    });
    
    test('should default to general for low keyword density', () => {
      const ckb = {
        content: {
          text: '这是一篇很长的文章，内容涉及很多方面。其中提到了一次旅游经历，但这只是文章的一小部分。文章主要讨论的是其他话题，比如工作、生活、学习等等。总之，这是一篇内容丰富的文章。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      // Should default to general because keyword density is too low
      expect(result.domain).toBe('general');
      expect(result.metadata.keywordDensity).toBeLessThan(0.02);
    });
    
    test('should complete within performance requirement', () => {
      const ckb = {
        content: {
          text: '苏杭四日游，人均800多点，冬天去最合适。主要景点有西湖、乌镇西栅、南浔古镇。'.repeat(10)
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.executionTime).toBeLessThan(10); // < 10ms requirement
    });
    
    test('should handle missing content object', () => {
      const ckb = {};
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.domain).toBe('general');
      expect(result.confidence).toBe(1.0);
    });
    
    test('should include metadata with keyword statistics', () => {
      const ckb = {
        content: {
          text: '苏杭旅游攻略，景点推荐，行程安排。'
        }
      };
      
      const result = domainDetector.detectDomain(ckb);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.keywordCount).toBeGreaterThan(0);
      expect(result.metadata.totalWords).toBeGreaterThan(0);
      expect(result.metadata.keywordDensity).toBeGreaterThan(0);
      expect(result.metadata.allScores).toBeDefined();
    });
  });
  
  describe('getDomainKeywords', () => {
    test('should return travel keywords', () => {
      const keywords = domainDetector.getDomainKeywords('travel');
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('旅游');
      expect(keywords).toContain('景点');
    });
    
    test('should return medical keywords', () => {
      const keywords = domainDetector.getDomainKeywords('medical');
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('医疗');
      expect(keywords).toContain('病人');
    });
    
    test('should return empty array for unknown domain', () => {
      const keywords = domainDetector.getDomainKeywords('unknown');
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBe(0);
    });
    
    test('should return empty array for general domain', () => {
      const keywords = domainDetector.getDomainKeywords('general');
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBe(0);
    });
  });
  
  describe('detectDomainFromText', () => {
    test('should detect domain from text string', () => {
      const text = '苏杭旅游攻略，景点推荐，行程安排。';
      
      const result = domainDetector.detectDomainFromText(text);
      
      expect(result.domain).toBe('travel');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });
  
  describe('matchesDomain', () => {
    test('should return true when content matches target domain', () => {
      const ckb = {
        content: {
          text: '苏杭四日游，人均800多点，冬天去最合适。主要景点有西湖、乌镇西栅、南浔古镇。'
        }
      };
      
      const matches = domainDetector.matchesDomain(ckb, 'travel');
      
      expect(matches).toBe(true);
    });
    
    test('should return false when content does not match target domain', () => {
      const ckb = {
        content: {
          text: '苏杭四日游，人均800多点，冬天去最合适。主要景点有西湖、乌镇西栅、南浔古镇。'
        }
      };
      
      const matches = domainDetector.matchesDomain(ckb, 'medical');
      
      expect(matches).toBe(false);
    });
    
    test('should respect minimum confidence threshold', () => {
      const ckb = {
        content: {
          text: '今天天气很好，我去公园散步了一次。'
        }
      };
      
      const matches = domainDetector.matchesDomain(ckb, 'travel', 0.9);
      
      expect(matches).toBe(false); // No travel keywords, should not match
    });
  });
  
  describe('getAllDomainScores', () => {
    test('should return scores for all domains', () => {
      const ckb = {
        content: {
          text: '苏杭旅游攻略，景点推荐，行程安排。'
        }
      };
      
      const scores = domainDetector.getAllDomainScores(ckb);
      
      expect(typeof scores).toBe('object');
      expect(scores.travel).toBeGreaterThan(0);
    });
  });
});
