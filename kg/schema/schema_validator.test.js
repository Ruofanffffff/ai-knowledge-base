/**
 * Unit Tests for Schema Validator
 */

const {
  validateSchema,
  validateAnchorFields,
  validateAnchorConfig,
  validateAnchorFieldsForEntityType,
  validateSchemas,
  VALID_NORMALIZATION_STRATEGIES,
  VALID_CONFLICT_STRATEGIES,
  VALID_TIME_GRANULARITIES
} = require('./schema_validator');

describe('Schema Validator', () => {
  describe('validateSchema', () => {
    it('should validate a complete valid schema', () => {
      const schema = {
        schema_name: 'Test Schema',
        entity_type: 'EventEntity',
        core_fields: [
          { name: '区域', weight: 0.3, required: true },
          { name: '时间', weight: 0.2, required: true }
        ],
        threshold: 0.75,
        anchor_fields: [
          { name: '区域', normalization_strategy: 'location', priority: 1 },
          { name: '时间', normalization_strategy: 'time_month', priority: 2 }
        ],
        anchor_config: {
          time_granularity: 'month',
          allow_fuzzy_match: false,
          conflict_strategy: 'llm_advisory'
        }
      };
      
      const result = validateSchema(schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject schema without schema_name', () => {
      const schema = {
        entity_type: 'EventEntity',
        core_fields: [],
        threshold: 0.75
      };
      
      const result = validateSchema(schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: schema_name');
    });
    
    it('should reject schema without entity_type', () => {
      const schema = {
        schema_name: 'Test',
        core_fields: [],
        threshold: 0.75
      };
      
      const result = validateSchema(schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: entity_type');
    });
    
    it('should reject schema with invalid threshold', () => {
      const schema = {
        schema_name: 'Test',
        entity_type: 'EventEntity',
        core_fields: [],
        threshold: 1.5
      };
      
      const result = validateSchema(schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid threshold'))).toBe(true);
    });
    
    it('should reject schema with invalid core_fields', () => {
      const schema = {
        schema_name: 'Test',
        entity_type: 'EventEntity',
        core_fields: 'not an array',
        threshold: 0.75
      };
      
      const result = validateSchema(schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('core_fields'))).toBe(true);
    });
  });
  
  describe('validateAnchorFields', () => {
    const coreFields = [
      { name: '区域', weight: 0.3, required: true },
      { name: '时间', weight: 0.2, required: true },
      { name: '指标', weight: 0.2, required: true }
    ];
    
    it('should validate correct anchor_fields', () => {
      const anchorFields = [
        { name: '区域', normalization_strategy: 'location', priority: 1 },
        { name: '时间', normalization_strategy: 'time_month', priority: 2 }
      ];
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors).toHaveLength(0);
    });
    
    it('should reject non-array anchor_fields', () => {
      const anchorFields = 'not an array';
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must be an array');
    });
    
    it('should reject empty anchor_fields', () => {
      const anchorFields = [];
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('cannot be empty');
    });
    
    it('should reject anchor field without name', () => {
      const anchorFields = [
        { normalization_strategy: 'location' }
      ];
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Missing field name');
    });
    
    it('should reject anchor field not in core_fields', () => {
      const anchorFields = [
        { name: '不存在的字段', normalization_strategy: 'location' }
      ];
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('not found in core_fields');
    });
    
    it('should reject invalid normalization_strategy', () => {
      const anchorFields = [
        { name: '区域', normalization_strategy: 'invalid_strategy' }
      ];
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid normalization_strategy');
    });
    
    it('should reject duplicate field names', () => {
      const anchorFields = [
        { name: '区域', normalization_strategy: 'location' },
        { name: '区域', normalization_strategy: 'lowercase' }
      ];
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Duplicate field name'))).toBe(true);
    });
    
    it('should reject invalid priority', () => {
      const anchorFields = [
        { name: '区域', normalization_strategy: 'location', priority: -1 }
      ];
      
      const errors = validateAnchorFields(anchorFields, coreFields);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid priority');
    });
    
    it('should accept all valid normalization strategies', () => {
      VALID_NORMALIZATION_STRATEGIES.forEach(strategy => {
        const anchorFields = [
          { name: '区域', normalization_strategy: strategy }
        ];
        
        const errors = validateAnchorFields(anchorFields, coreFields);
        
        expect(errors).toHaveLength(0);
      });
    });
  });
  
  describe('validateAnchorConfig', () => {
    it('should validate correct anchor_config', () => {
      const anchorConfig = {
        time_granularity: 'month',
        allow_fuzzy_match: false,
        conflict_strategy: 'llm_advisory'
      };
      
      const errors = validateAnchorConfig(anchorConfig);
      
      expect(errors).toHaveLength(0);
    });
    
    it('should reject non-object anchor_config', () => {
      const anchorConfig = 'not an object';
      
      const errors = validateAnchorConfig(anchorConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must be an object');
    });
    
    it('should reject invalid time_granularity', () => {
      const anchorConfig = {
        time_granularity: 'invalid'
      };
      
      const errors = validateAnchorConfig(anchorConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid time_granularity');
    });
    
    it('should reject non-boolean allow_fuzzy_match', () => {
      const anchorConfig = {
        allow_fuzzy_match: 'not a boolean'
      };
      
      const errors = validateAnchorConfig(anchorConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must be a boolean');
    });
    
    it('should reject invalid conflict_strategy', () => {
      const anchorConfig = {
        conflict_strategy: 'invalid'
      };
      
      const errors = validateAnchorConfig(anchorConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid conflict_strategy');
    });
    
    it('should accept all valid time granularities', () => {
      VALID_TIME_GRANULARITIES.forEach(granularity => {
        const anchorConfig = {
          time_granularity: granularity
        };
        
        const errors = validateAnchorConfig(anchorConfig);
        
        expect(errors).toHaveLength(0);
      });
    });
    
    it('should accept all valid conflict strategies', () => {
      VALID_CONFLICT_STRATEGIES.forEach(strategy => {
        const anchorConfig = {
          conflict_strategy: strategy
        };
        
        const errors = validateAnchorConfig(anchorConfig);
        
        expect(errors).toHaveLength(0);
      });
    });
    
    it('should accept empty anchor_config', () => {
      const anchorConfig = {};
      
      const errors = validateAnchorConfig(anchorConfig);
      
      expect(errors).toHaveLength(0);
    });
  });
  
  describe('validateAnchorFieldsForEntityType', () => {
    it('should warn if EventEntity lacks time field', () => {
      const anchorFields = [
        { name: '区域', normalization_strategy: 'location' }
      ];
      
      const result = validateAnchorFieldsForEntityType('EventEntity', anchorFields);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('time-based anchor field');
    });
    
    it('should not warn if EventEntity has time field', () => {
      const anchorFields = [
        { name: '区域', normalization_strategy: 'location' },
        { name: '时间', normalization_strategy: 'time_month' }
      ];
      
      const result = validateAnchorFieldsForEntityType('EventEntity', anchorFields);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
    
    it('should warn if LocationEntity lacks location field', () => {
      const anchorFields = [
        { name: '名称', normalization_strategy: 'lowercase' }
      ];
      
      const result = validateAnchorFieldsForEntityType('LocationEntity', anchorFields);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('location-based anchor field');
    });
    
    it('should not warn if LocationEntity has location field', () => {
      const anchorFields = [
        { name: '区域', normalization_strategy: 'location' }
      ];
      
      const result = validateAnchorFieldsForEntityType('LocationEntity', anchorFields);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
  
  describe('validateSchemas', () => {
    it('should validate multiple schemas', () => {
      const schemas = [
        {
          schema_name: 'Schema 1',
          entity_type: 'EventEntity',
          core_fields: [{ name: '区域', weight: 0.5, required: true }],
          threshold: 0.75,
          anchor_fields: [{ name: '区域', normalization_strategy: 'location' }]
        },
        {
          schema_name: 'Schema 2',
          entity_type: 'LocationEntity',
          core_fields: [{ name: '名称', weight: 0.5, required: true }],
          threshold: 0.6,
          anchor_fields: [{ name: '名称', normalization_strategy: 'location' }]
        }
      ];
      
      const result = validateSchemas(schemas);
      
      expect(result.valid).toBe(true);
      expect(result.totalSchemas).toBe(2);
      expect(result.validSchemas).toBe(2);
      expect(result.invalidSchemas).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should report invalid schemas', () => {
      const schemas = [
        {
          schema_name: 'Valid Schema',
          entity_type: 'EventEntity',
          core_fields: [{ name: '区域', weight: 0.5, required: true }],
          threshold: 0.75
        },
        {
          // Missing schema_name
          entity_type: 'EventEntity',
          core_fields: [],
          threshold: 0.75
        }
      ];
      
      const result = validateSchemas(schemas);
      
      expect(result.valid).toBe(false);
      expect(result.totalSchemas).toBe(2);
      expect(result.validSchemas).toBe(1);
      expect(result.invalidSchemas).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].schemaIndex).toBe(1);
    });
  });
});
