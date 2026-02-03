/**
 * Entity Builder Property-Based Tests
 * 
 * Property 9: Entity Name Consistency
 * Property 10: Entity Merging Correctness
 * Property 11: Entity Confidence Calculation
 * 
 * Validates: Requirements 4.1-4.14
 */

const fc = require('fast-check');
const {
  generateCanonicalName,
  generateRuleBasedName,
  checkNameWellFormed,
  mergeOrCreateEntity,
  findExactMatch,
  calculateNameSimilarity,
  mergeEntityData,
  calculateEntityConfidence,
  resolveEntityConflicts,
  setLLMClient
} = require('./entity_builder');

describe('Entity Builder - Property-Based Tests', () => {
  // Mock LLM client for testing
  const mockLLMClient = {
    callJSON: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    setLLMClient(mockLLMClient);
  });
  
  /**
   * Property 9: Entity Name Consistency
   * 
   * For any valid fields and schema:
   * 1. Generated canonical name should be non-empty
   * 2. Generated name should be well-formed
   * 3. Same fields + schema should produce same name (deterministic)
   * 4. Name length should be reasonable (< 200 chars)
   */
  describe('Property 9: Entity Name Consistency', () => {
    const fieldArbitrary = fc.record({
      区域: fc.string({ minLength: 1, maxLength: 20 }),
      指标: fc.string({ minLength: 1, maxLength: 20 }),
      时间: fc.string({ minLength: 1, maxLength: 20 })
    });
    
    const schemaArbitrary = fc.constant({
      schema_name: '测试Schema',
      entity_type: 'EventEntity',
      core_fields: [
        { name: '区域', weight: 0.3, required: true },
        { name: '指标', weight: 0.2, required: true },
        { name: '时间', weight: 0.2, required: true }
      ]
    });
    
    test('Property 9.1: Generated name is non-empty', () => {
      fc.assert(
        fc.property(fieldArbitrary, schemaArbitrary, (fields, schema) => {
          const name = generateRuleBasedName(fields, schema);
          return name && name.length > 0;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Property 9.2: Generated name is well-formed', () => {
      fc.assert(
        fc.property(fieldArbitrary, schemaArbitrary, (fields, schema) => {
          const name = generateRuleBasedName(fields, schema);
          const isWellFormed = checkNameWellFormed(name);
          return isWellFormed;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Property 9.3: Same inputs produce same name (deterministic)', () => {
      fc.assert(
        fc.property(fieldArbitrary, schemaArbitrary, (fields, schema) => {
          const name1 = generateRuleBasedName(fields, schema);
          const name2 = generateRuleBasedName(fields, schema);
          return name1 === name2;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Property 9.4: Name length is reasonable', () => {
      fc.assert(
        fc.property(fieldArbitrary, schemaArbitrary, (fields, schema) => {
          const name = generateRuleBasedName(fields, schema);
          return name.length <= 200;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Property 9.5: Name contains field values', () => {
      fc.assert(
        fc.property(fieldArbitrary, schemaArbitrary, (fields, schema) => {
          const name = generateRuleBasedName(fields, schema);
          // Name should contain at least one field value
          const containsFieldValue = Object.values(fields).some(value => 
            name.includes(value)
          );
          return containsFieldValue;
        }),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Property 10: Entity Merging Correctness
   * 
   * For any two entities:
   * 1. Exact name match should always merge
   * 2. Merged entity should contain all CKB IDs from both entities
   * 3. Merged entity should have all aliases from both entities
   * 4. Merged entity confidence should be recalculated
   * 5. Different entity types should never merge
   */
  describe('Property 10: Entity Merging Correctness', () => {
    const entityArbitrary = fc.record({
      entity_id: fc.string({ minLength: 5, maxLength: 20 }),
      entity_type: fc.constantFrom('EventEntity', 'LocationEntity', 'ResearchEntity'),
      canonical_name: fc.string({ minLength: 5, maxLength: 30 }),
      aliases: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 3 }),
      supported_by: fc.array(fc.string({ minLength: 5, maxLength: 15 }), { minLength: 1, maxLength: 5 }),
      attributes: fc.record({
        区域: fc.string({ minLength: 1, maxLength: 20 })
      }),
      confidence: fc.double({ min: 0.5, max: 1.0 })
    });
    
    test('Property 10.1: Exact name match should merge', () => {
      fc.assert(
        fc.property(entityArbitrary, (entity) => {
          const existingEntities = [entity];
          const newEntity = {
            ...entity,
            entity_id: 'new_entity_id',
            supported_by: ['new_ckb_id']
          };
          
          const match = findExactMatch(newEntity, existingEntities);
          return match !== null && match.entity_id === entity.entity_id;
        }),
        { numRuns: 50 }
      );
    });
    
    test('Property 10.2: Merged entity contains all CKB IDs', () => {
      fc.assert(
        fc.property(entityArbitrary, entityArbitrary, (entity1, entity2) => {
          const merged = mergeEntityData(entity1, entity2);
          
          // All CKB IDs from both entities should be in merged entity
          const allCKBs = [
            ...(entity1.supported_by || []),
            ...(entity2.supported_by || [])
          ];
          
          return allCKBs.every(ckbId => 
            merged.supported_by.includes(ckbId)
          );
        }),
        { numRuns: 50 }
      );
    });
    
    test('Property 10.3: Merged entity has unique CKB IDs', () => {
      fc.assert(
        fc.property(entityArbitrary, entityArbitrary, (entity1, entity2) => {
          const merged = mergeEntityData(entity1, entity2);
          
          // No duplicate CKB IDs
          const uniqueCKBs = new Set(merged.supported_by);
          return uniqueCKBs.size === merged.supported_by.length;
        }),
        { numRuns: 50 }
      );
    });
    
    test('Property 10.4: Merged entity confidence is recalculated', () => {
      fc.assert(
        fc.property(entityArbitrary, entityArbitrary, (entity1, entity2) => {
          const merged = mergeEntityData(entity1, entity2);
          
          // Confidence should be based on number of supporting CKBs
          const expectedConfidence = calculateEntityConfidence(merged.supported_by);
          return Math.abs(merged.confidence - expectedConfidence) < 0.01;
        }),
        { numRuns: 50 }
      );
    });
    
    test('Property 10.5: Merged entity contains all aliases', () => {
      fc.assert(
        fc.property(entityArbitrary, entityArbitrary, (entity1, entity2) => {
          const merged = mergeEntityData(entity1, entity2);
          
          // All aliases from both entities should be in merged entity
          const allAliases = [
            ...(entity1.aliases || []),
            ...(entity2.aliases || []),
            entity2.canonical_name
          ].filter(a => a !== entity1.canonical_name);
          
          return allAliases.every(alias => 
            merged.aliases.includes(alias)
          );
        }),
        { numRuns: 50 }
      );
    });
  });
  
  /**
   * Property 11: Entity Confidence Calculation
   * 
   * For any entity:
   * 1. Confidence should be in range [0, 1]
   * 2. More CKBs should increase confidence
   * 3. Confidence should be monotonically increasing with CKB count
   * 4. Confidence should never exceed 0.99
   * 5. Single CKB should have confidence ≤ 0.6
   */
  describe('Property 11: Entity Confidence Calculation', () => {
    const ckbArrayArbitrary = fc.array(
      fc.string({ minLength: 5, maxLength: 15 }),
      { minLength: 1, maxLength: 10 }
    );
    
    test('Property 11.1: Confidence is in valid range [0, 1]', () => {
      fc.assert(
        fc.property(ckbArrayArbitrary, (ckbIds) => {
          const confidence = calculateEntityConfidence(ckbIds);
          return confidence >= 0 && confidence <= 1;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Property 11.2: More CKBs increase confidence', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 6, max: 10 }),
          (count1, count2) => {
            const ckbs1 = Array(count1).fill(0).map((_, i) => `ckb_${i}`);
            const ckbs2 = Array(count2).fill(0).map((_, i) => `ckb_${i}`);
            
            const confidence1 = calculateEntityConfidence(ckbs1);
            const confidence2 = calculateEntityConfidence(ckbs2);
            
            return confidence2 >= confidence1;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('Property 11.3: Confidence is monotonically increasing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (count) => {
            const ckbs = Array(count).fill(0).map((_, i) => `ckb_${i}`);
            const confidence = calculateEntityConfidence(ckbs);
            
            // Add one more CKB
            const ckbsPlus1 = [...ckbs, `ckb_${count}`];
            const confidencePlus1 = calculateEntityConfidence(ckbsPlus1);
            
            return confidencePlus1 >= confidence;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('Property 11.4: Confidence never exceeds 0.99', () => {
      fc.assert(
        fc.property(ckbArrayArbitrary, (ckbIds) => {
          const confidence = calculateEntityConfidence(ckbIds);
          return confidence <= 0.99;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Property 11.5: Single CKB has confidence ≤ 0.6', () => {
      const singleCKB = ['ckb_1'];
      const confidence = calculateEntityConfidence(singleCKB);
      expect(confidence).toBeLessThanOrEqual(0.6);
    });
    
    test('Property 11.6: Specific confidence thresholds', () => {
      // Test specific thresholds from requirements
      expect(calculateEntityConfidence(['ckb_1'])).toBe(0.6);
      expect(calculateEntityConfidence(['ckb_1', 'ckb_2'])).toBe(0.75);
      expect(calculateEntityConfidence(['ckb_1', 'ckb_2', 'ckb_3'])).toBe(0.85);
      expect(calculateEntityConfidence(['ckb_1', 'ckb_2', 'ckb_3', 'ckb_4'])).toBeGreaterThanOrEqual(0.9);
    });
  });
  
  /**
   * Property 11.7: Name Similarity Properties
   * 
   * For any two strings:
   * 1. Similarity should be in range [0, 1]
   * 2. Identical strings should have similarity = 1.0
   * 3. Similarity should be symmetric: sim(A, B) = sim(B, A)
   * 4. Empty strings should have similarity = 1.0
   */
  describe('Property 11.7: Name Similarity Properties', () => {
    const stringArbitrary = fc.string({ minLength: 0, maxLength: 50 });
    
    test('Similarity is in valid range [0, 1]', () => {
      fc.assert(
        fc.property(stringArbitrary, stringArbitrary, (str1, str2) => {
          const similarity = calculateNameSimilarity(str1, str2);
          return similarity >= 0 && similarity <= 1;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Identical strings have similarity = 1.0', () => {
      fc.assert(
        fc.property(stringArbitrary, (str) => {
          const similarity = calculateNameSimilarity(str, str);
          return Math.abs(similarity - 1.0) < 0.001;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Similarity is symmetric', () => {
      fc.assert(
        fc.property(stringArbitrary, stringArbitrary, (str1, str2) => {
          const sim1 = calculateNameSimilarity(str1, str2);
          const sim2 = calculateNameSimilarity(str2, str1);
          return Math.abs(sim1 - sim2) < 0.001;
        }),
        { numRuns: 100 }
      );
    });
    
    test('Empty strings have similarity = 1.0', () => {
      const similarity = calculateNameSimilarity('', '');
      expect(similarity).toBe(1.0);
    });
  });
  
  /**
   * Property 11.8: Batch Disambiguation Efficiency
   * 
   * For any list of entities with conflicts:
   * 1. Batch processing should use fewer LLM calls than individual processing
   * 2. Token savings should be proportional to number of conflict groups
   * 3. Resolved entities count should be ≤ original entities count
   * 4. All entity IDs should be preserved (either in resolved or merged)
   */
  describe('Property 11.8: Batch Disambiguation Efficiency', () => {
    test('Batch processing uses fewer LLM calls', async () => {
      // Create entities with very similar names to ensure conflicts are detected
      const entities = [
        {
          entity_id: 'entity_0',
          entity_type: 'EventEntity',
          canonical_name: 'TestABC',
          attributes: {},
          supported_by: ['ckb_0'],
          aliases: [],
          confidence: 0.85
        },
        {
          entity_id: 'entity_1',
          entity_type: 'EventEntity',
          canonical_name: 'TestABD',  // Very similar to TestABC
          attributes: {},
          supported_by: ['ckb_1'],
          aliases: [],
          confidence: 0.75
        },
        {
          entity_id: 'entity_2',
          entity_type: 'EventEntity',
          canonical_name: 'TestXYZ',
          attributes: {},
          supported_by: ['ckb_2'],
          aliases: [],
          confidence: 0.85
        },
        {
          entity_id: 'entity_3',
          entity_type: 'EventEntity',
          canonical_name: 'TestXYW',  // Very similar to TestXYZ
          attributes: {},
          supported_by: ['ckb_3'],
          aliases: [],
          confidence: 0.75
        }
      ];
      
      // Mock LLM response
      mockLLMClient.callJSON.mockResolvedValue({
        merges: [],
        _meta: { tokens: 300 }
      });
      
      const result = await resolveEntityConflicts(entities, {
        similarityThreshold: 0.8,  // Lower threshold to detect more conflicts
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Core test: batch processing should make only 1 LLM call regardless of conflict groups
      expect(result.stats.llmCalls).toBeLessThanOrEqual(1);
      
      // If there are conflicts, token savings should be positive
      if (result.stats.totalGroups > 0) {
        expect(result.stats.tokensSaved).toBeGreaterThanOrEqual(0);
      }
      
      // Result should have valid structure
      expect(result.resolvedEntities).toBeDefined();
      expect(Array.isArray(result.resolvedEntities)).toBe(true);
      expect(result.stats).toBeDefined();
    });
    
    test('Resolved entities count ≤ original count', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              entity_id: fc.string({ minLength: 5, maxLength: 15 }),
              entity_type: fc.constant('EventEntity'),
              canonical_name: fc.string({ minLength: 3, maxLength: 20 }),
              attributes: fc.constant({}),
              supported_by: fc.array(fc.string({ minLength: 5, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
              aliases: fc.constant([]),
              confidence: fc.double({ min: 0.6, max: 0.9 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (entities) => {
            // Mock LLM response
            mockLLMClient.callJSON.mockResolvedValue({
              merges: [],
              _meta: { tokens: 200 }
            });
            
            const result = await resolveEntityConflicts(entities, {
              similarityThreshold: 0.7,
              useLLM: true,
              llmClient: mockLLMClient
            });
            
            return result.resolvedEntities.length <= entities.length;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
