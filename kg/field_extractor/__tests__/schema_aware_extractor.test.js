/**
 * Schema-aware Field Extractor Tests
 */

const SchemaAwareExtractor = require('../schema_aware_extractor');

// Mock dependencies
jest.mock('../rule_extractor');
jest.mock('../ner_extractor');

const ruleExtractor = require('../rule_extractor');
const nerExtractor = require('../ner_extractor');

describe('SchemaAwareExtractor', () => {
  let extractor;
  
  beforeEach(() => {
    extractor = new SchemaAwareExtractor({
      criticalFieldWeightThreshold: 0.4,
      enableCache: false
    });
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultExtractor = new SchemaAwareExtractor();
      expect(defaultExtractor.criticalFieldWeightThreshold).toBe(0.4);
      expect(defaultExtractor.enableCache).toBe(true);
    });
    
    it('should initialize with custom options', () => {
      const customExtractor = new SchemaAwareExtractor({
        criticalFieldWeightThreshold: 0.3,
        enableCache: false
      });
      expect(customExtractor.criticalFieldWeightThreshold).toBe(0.3);
      expect(customExtractor.enableCache).toBe(false);
    });
  });
  
  describe('_collectRequiredFields', () => {
    it('should collect core fields from schemas', () => {
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [
            { name: '项目名称', weight: 0.4, required: true },
            { name: '地点', weight: 0.2, required: false }
          ],
          relations: []
        }
      ];
      
      const fields = extractor._collectRequiredFields(schemas);
      
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('项目名称');
      expect(fields[0].weight).toBe(0.4);
      expect(fields[0].required).toBe(true);
      expect(fields[0].sources).toHaveLength(1);
      expect(fields[0].sources[0].schema).toBe('Project-Entity');
      expect(fields[0].sources[0].type).toBe('core');
    });
    
    it('should collect relation target fields from schemas', () => {
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [],
          relations: [
            {
              type: 'located_in',
              relation_type_id: 'project_located_in',
              target_field: '地点'
            },
            {
              type: 'participate',
              relation_type_id: 'org_participate_project',
              target_field: '执行单位'
            }
          ]
        }
      ];
      
      const fields = extractor._collectRequiredFields(schemas);
      
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('地点');
      expect(fields[0].weight).toBe(0.5);
      expect(fields[0].sources[0].type).toBe('relation');
      expect(fields[0].sources[0].relation_type).toBe('located_in');
      
      expect(fields[1].name).toBe('执行单位');
      expect(fields[1].sources[0].relation_type).toBe('participate');
    });
    
    it('should merge fields from multiple schemas', () => {
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [
            { name: '项目名称', weight: 0.4, required: true }
          ],
          relations: [
            { type: 'located_in', target_field: '地点' }
          ]
        },
        {
          name: 'Organization-Entity',
          coreFields: [
            { name: '项目名称', weight: 0.3, required: false }
          ],
          relations: [
            { type: 'participate', target_field: '地点' }
          ]
        }
      ];
      
      const fields = extractor._collectRequiredFields(schemas);
      
      expect(fields).toHaveLength(2);
      
      const projectField = fields.find(f => f.name === '项目名称');
      expect(projectField.sources).toHaveLength(2);
      expect(projectField.sources[0].schema).toBe('Project-Entity');
      expect(projectField.sources[1].schema).toBe('Organization-Entity');
      
      const locationField = fields.find(f => f.name === '地点');
      expect(locationField.sources).toHaveLength(2);
    });
    
    it('should handle JSON string coreFields', () => {
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: JSON.stringify([
            { name: '项目名称', weight: 0.4, required: true }
          ]),
          relations: []
        }
      ];
      
      const fields = extractor._collectRequiredFields(schemas);
      
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('项目名称');
    });
    
    it('should handle JSON string relations', () => {
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [],
          relations: JSON.stringify([
            { type: 'located_in', target_field: '地点' }
          ])
        }
      ];
      
      const fields = extractor._collectRequiredFields(schemas);
      
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('地点');
    });
    
    it('should handle invalid JSON gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: 'invalid json',
          relations: 'invalid json'
        }
      ];
      
      const fields = extractor._collectRequiredFields(schemas);
      
      expect(fields).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      
      consoleSpy.mockRestore();
    });
    
    it('should handle missing target_field in relations', () => {
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [],
          relations: [
            { type: 'located_in' }  // Missing target_field
          ]
        }
      ];
      
      const fields = extractor._collectRequiredFields(schemas);
      
      expect(fields).toHaveLength(0);
    });
  });
  
  describe('_findMissingCriticalFields', () => {
    it('should identify missing required fields', () => {
      const requiredFields = [
        { name: '项目名称', weight: 0.4, required: true, sources: [] },
        { name: '地点', weight: 0.2, required: false, sources: [] }
      ];
      
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const schemas = [];
      
      const missing = extractor._findMissingCriticalFields(
        requiredFields,
        extractedFields,
        schemas
      );
      
      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('项目名称');
    });
    
    it('should identify missing relation fields', () => {
      const requiredFields = [
        {
          name: '地点',
          weight: 0.5,
          required: false,
          sources: [{ type: 'relation', relation_type: 'located_in' }]
        },
        {
          name: '执行单位',
          weight: 0.5,
          required: false,
          sources: [{ type: 'relation', relation_type: 'participate' }]
        }
      ];
      
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const schemas = [];
      
      const missing = extractor._findMissingCriticalFields(
        requiredFields,
        extractedFields,
        schemas
      );
      
      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('执行单位');
    });
    
    it('should not include non-critical missing fields', () => {
      const requiredFields = [
        { name: '项目名称', weight: 0.4, required: true, sources: [] },
        { name: '描述', weight: 0.1, required: false, sources: [{ type: 'core' }] }
      ];
      
      const extractedFields = [];
      
      const schemas = [];
      
      const missing = extractor._findMissingCriticalFields(
        requiredFields,
        extractedFields,
        schemas
      );
      
      expect(missing).toHaveLength(1);
      expect(missing[0].name).toBe('项目名称');
    });
    
    it('should return empty array when all critical fields are extracted', () => {
      const requiredFields = [
        { name: '项目名称', weight: 0.4, required: true, sources: [] },
        {
          name: '地点',
          weight: 0.5,
          required: false,
          sources: [{ type: 'relation' }]
        }
      ];
      
      const extractedFields = [
        { name: '项目名称', value: '美兰机场项目' },
        { name: '地点', value: '海南省海口市' }
      ];
      
      const schemas = [];
      
      const missing = extractor._findMissingCriticalFields(
        requiredFields,
        extractedFields,
        schemas
      );
      
      expect(missing).toHaveLength(0);
    });
  });
  
  describe('_mergeFields', () => {
    it('should merge rule and NER fields', () => {
      const ruleFields = [
        { name: '项目名称', value: '美兰机场项目', type: 'text' },
        { name: '时间', value: '2023年', type: 'time' }
      ];
      
      const nerFields = [
        { name: '地点', value: '海南省海口市', type: 'location' },
        { name: '执行单位', value: '上海商汤智能科技', type: 'entity' }
      ];
      
      const merged = extractor._mergeFields(ruleFields, nerFields);
      
      expect(merged).toHaveLength(4);
      expect(merged[0].name).toBe('项目名称');
      expect(merged[0].sources).toEqual(['rule']);
      expect(merged[2].name).toBe('地点');
      expect(merged[2].sources).toEqual(['ner']);
    });
    
    it('should not duplicate fields from both sources', () => {
      const ruleFields = [
        { name: '地点', value: '海南省', type: 'location' }
      ];
      
      const nerFields = [
        { name: '地点', value: '海南省海口市', type: 'location' }
      ];
      
      const merged = extractor._mergeFields(ruleFields, nerFields);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].name).toBe('地点');
      // When a field exists in both sources, NER source is added
      expect(merged[0].sources).toEqual(['rule', 'ner']);
    });
    
    it('should add NER source to existing rule field', () => {
      const ruleFields = [
        { name: '地点', value: '海南省', type: 'location', sources: ['rule'] }
      ];
      
      const nerFields = [
        { name: '地点', value: '海南省海口市', type: 'location' }
      ];
      
      const merged = extractor._mergeFields(ruleFields, nerFields);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].sources).toContain('rule');
      expect(merged[0].sources).toContain('ner');
    });
    
    it('should handle empty inputs', () => {
      expect(extractor._mergeFields([], [])).toHaveLength(0);
      
      const ruleFields = [{ name: '项目名称', value: 'test' }];
      expect(extractor._mergeFields(ruleFields, [])).toHaveLength(1);
      
      const nerFields = [{ name: '地点', value: 'test' }];
      expect(extractor._mergeFields([], nerFields)).toHaveLength(1);
    });
  });
  
  describe('extractFields', () => {
    beforeEach(() => {
      // Setup default mocks
      ruleExtractor.extractFields = jest.fn().mockResolvedValue([
        { name: '项目名称', value: '美兰机场项目', type: 'text' },
        { name: '时间', value: '2023年', type: 'time' }
      ]);
      
      nerExtractor.extractEntities = jest.fn().mockResolvedValue([
        { name: '地点', value: '海南省海口市', type: 'location' }
      ]);
    });
    
    it('should extract fields using rule and NER extractors', async () => {
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '海南省海口市美兰机场项目于2023年启动' }
      };
      
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [
            { name: '项目名称', weight: 0.4, required: true }
          ],
          relations: []
        }
      ];
      
      const fields = await extractor.extractFields(ckb, schemas);
      
      // Should pass requiredFields to rule extractor
      expect(ruleExtractor.extractFields).toHaveBeenCalledWith(
        ckb.content.text,
        [{ name: '项目名称', weight: 0.4, required: true, sources: [{ schema: 'Project-Entity', type: 'core', weight: 0.4 }] }]
      );
      expect(nerExtractor.extractEntities).toHaveBeenCalledWith(ckb.content.text);
      expect(fields).toHaveLength(3);
    });
    
    it('should mark missing critical fields for LLM enhancement', async () => {
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '海南省海口市美兰机场项目' }
      };
      
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [
            { name: '项目名称', weight: 0.4, required: true }
          ],
          relations: [
            { type: 'participate', target_field: '执行单位' }
          ]
        }
      ];
      
      const fields = await extractor.extractFields(ckb, schemas, {
        enableLLM: true
      });
      
      expect(ckb._missingCriticalFields).toBeDefined();
      expect(ckb._missingCriticalFields).toHaveLength(1);
      expect(ckb._missingCriticalFields[0].name).toBe('执行单位');
    });
    
    it('should not mark fields when LLM is disabled', async () => {
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '海南省海口市美兰机场项目' }
      };
      
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [],
          relations: [
            { type: 'participate', target_field: '执行单位' }
          ]
        }
      ];
      
      await extractor.extractFields(ckb, schemas, {
        enableLLM: false
      });
      
      expect(ckb._missingCriticalFields).toBeUndefined();
    });
    
    it('should not mark fields when all critical fields are extracted', async () => {
      ruleExtractor.extractFields = jest.fn().mockResolvedValue([
        { name: '项目名称', value: '美兰机场项目', type: 'text' },
        { name: '执行单位', value: '上海商汤智能科技', type: 'entity' }
      ]);
      
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '海南省海口市美兰机场项目' }
      };
      
      const schemas = [
        {
          name: 'Project-Entity',
          coreFields: [
            { name: '项目名称', weight: 0.4, required: true }
          ],
          relations: [
            { type: 'participate', target_field: '执行单位' }
          ]
        }
      ];
      
      await extractor.extractFields(ckb, schemas, {
        enableLLM: true
      });
      
      expect(ckb._missingCriticalFields).toBeUndefined();
    });
    
    it('should handle empty text', async () => {
      const ckb = {
        ckb_id: 'ckb_1',
        content: { text: '' }
      };
      
      const schemas = [];
      
      const fields = await extractor.extractFields(ckb, schemas);
      
      expect(fields).toHaveLength(3); // From mocked extractors
    });
    
    it('should handle missing content', async () => {
      const ckb = {
        ckb_id: 'ckb_1'
      };
      
      const schemas = [];
      
      const fields = await extractor.extractFields(ckb, schemas);
      
      // Should pass empty requiredFields array when no schemas
      expect(ruleExtractor.extractFields).toHaveBeenCalledWith('', []);
      expect(fields).toHaveLength(3);
    });
  });
  
  describe('getExtractionStats', () => {
    it('should calculate correct statistics', () => {
      const extractedFields = [
        { name: '项目名称', sources: ['rule'] },
        { name: '地点', sources: ['ner'] },
        { name: '时间', sources: ['rule', 'ner'] }
      ];
      
      const stats = extractor.getExtractionStats(extractedFields);
      
      expect(stats.total).toBe(3);
      expect(stats.bySource.rule).toBe(1);
      expect(stats.bySource.ner).toBe(1);
      expect(stats.bySource.both).toBe(1);
    });
    
    it('should handle empty fields', () => {
      const stats = extractor.getExtractionStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.bySource.rule).toBe(0);
      expect(stats.bySource.ner).toBe(0);
      expect(stats.bySource.both).toBe(0);
    });
    
    it('should handle fields without sources', () => {
      const extractedFields = [
        { name: '项目名称' },
        { name: '地点', sources: [] }
      ];
      
      const stats = extractor.getExtractionStats(extractedFields);
      
      expect(stats.total).toBe(2);
      expect(stats.bySource.rule).toBe(0);
      expect(stats.bySource.ner).toBe(0);
      expect(stats.bySource.both).toBe(0);
    });
  });
});
