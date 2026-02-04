/**
 * Property-Based Tests for Token Optimization
 * 
 * Tests Properties 23, 24, 25:
 * - Property 23: Token Minimization for Schema Operations
 * - Property 24: Token Minimization for Co-occurrence
 * - Property 25: LLM Call Caching
 * 
 * Validates: Requirements 11.2, 11.3, 11.4, 11.7
 */

const fc = require('fast-check');
const { matchSchemas, calculateCompleteness } = require('../schema/schema_matcher');
const { buildRelations } = require('../relation/builtin_relation_builder');
const { buildCooccurrenceRelations } = require('../relation/cooccurrence_relation_builder');
const { getTokenStats, reset: resetTokenTracker } = require('./token_tracker');
const { get, set, clear: clearCache, getStats: getCacheStats } = require('./llm_cache');

describe('Property 23: Token Minimization for Schema Operations', () => {
  beforeEach(() => {
    resetTokenTracker();
  });

  /**
   * Property 23: For any schema matching or built-in relation generation operation,
   * zero LLM tokens should be consumed (pure rule-based).
   */
  test('Property 23.1: Schema matching consumes zero tokens', () => {
    const fieldArb = fc.array(
      fc.record({
        name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
        value: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        type: fc.constantFrom('location', 'time', 'indicator', 'number', 'unit'),
        confidence: fc.float({ min: 0.5, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n) && n > 0)
      }),
      { minLength: 0, maxLength: 10 }
    );

    const schemaArb = fc.array(
      fc.record({
        schema_id: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5),
        schema_name: fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length >= 5),
        entity_type: fc.constantFrom('EventEntity', 'LocationEntity', 'IndicatorEntity'),
        core_fields: fc.array(
          fc.record({
            name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
            weight: fc.float({ min: 0.1, max: 0.5 }).filter(n => !isNaN(n) && isFinite(n) && n > 0),
            required: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ).map(fields => {
          // Ensure unique field names and normalize weights to sum <= 1
          const uniqueFields = [];
          const seenNames = new Set();
          for (const field of fields) {
            if (!seenNames.has(field.name) && field.weight > 0) {
              uniqueFields.push(field);
              seenNames.add(field.name);
            }
          }
          // Ensure at least one field
          if (uniqueFields.length === 0) {
            uniqueFields.push({ name: '区域', weight: 1.0, required: true });
          }
          // Normalize weights to sum to 1
          const totalWeight = uniqueFields.reduce((sum, f) => sum + f.weight, 0);
          if (totalWeight > 0) {
            uniqueFields.forEach(f => {
              f.weight = Math.max(0.01, f.weight / totalWeight);
            });
          }
          return uniqueFields;
        }),
        threshold: fc.float({ min: 0.5, max: 0.9 }).filter(n => !isNaN(n) && isFinite(n) && n > 0),
        relations: fc.constant([])
      }),
      { minLength: 1, maxLength: 5 }
    );

    const sourceConfidenceArb = fc.float({ min: 0.5, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n) && n > 0);

    fc.assert(fc.property(fieldArb, schemaArb, sourceConfidenceArb, (fields, schemas, sourceConfidence) => {
      resetTokenTracker();
      
      // Perform schema matching
      const schemaScores = matchSchemas(fields, schemas, sourceConfidence);
      
      // Get token statistics
      const stats = getTokenStats();
      
      // Verify zero tokens consumed
      expect(stats.total_tokens).toBe(0);
      expect(stats.total_input_tokens).toBe(0);
      expect(stats.total_output_tokens).toBe(0);
      
      // Verify schema scores are valid
      expect(Array.isArray(schemaScores)).toBe(true);
      schemaScores.forEach(score => {
        expect(score.completeness).toBeGreaterThanOrEqual(0);
        expect(score.completeness).toBeLessThanOrEqual(1);
      });
    }), { numRuns: 20, timeout: 5000 });
  });

  test('Property 23.2: Completeness calculation consumes zero tokens', () => {
    const fieldArb = fc.array(
      fc.record({
        name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
        value: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        type: fc.constantFrom('location', 'time', 'indicator', 'number', 'unit'),
        confidence: fc.float({ min: 0.5, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n) && n > 0)
      }),
      { minLength: 0, maxLength: 10 }
    );

    const schemaArb = fc.record({
      schema_id: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5),
      schema_name: fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length >= 5),
      entity_type: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5),
      core_fields: fc.array(
        fc.record({
          name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
          weight: fc.float({ min: 0.1, max: 0.5 }).filter(n => !isNaN(n) && isFinite(n) && n > 0),
          required: fc.boolean()
        }),
        { minLength: 1, maxLength: 5 }
      ).map(fields => {
        // Ensure unique field names and normalize weights to sum <= 1
        const uniqueFields = [];
        const seenNames = new Set();
        for (const field of fields) {
          if (!seenNames.has(field.name) && field.weight > 0) {
            uniqueFields.push(field);
            seenNames.add(field.name);
          }
        }
        // Ensure at least one field
        if (uniqueFields.length === 0) {
          uniqueFields.push({ name: '区域', weight: 1.0, required: true });
        }
        // Normalize weights to sum to 1
        const totalWeight = uniqueFields.reduce((sum, f) => sum + f.weight, 0);
        if (totalWeight > 0) {
          uniqueFields.forEach(f => {
            f.weight = Math.max(0.01, f.weight / totalWeight);
          });
        }
        return uniqueFields;
      }),
      threshold: fc.float({ min: 0.5, max: 0.9 }).filter(n => !isNaN(n) && isFinite(n) && n > 0),
      relations: fc.constant([])
    });

    const sourceConfidenceArb = fc.float({ min: 0.5, max: 1.0 })
      .filter(n => !isNaN(n) && isFinite(n) && n > 0);

    fc.assert(fc.property(fieldArb, schemaArb, sourceConfidenceArb, (fields, schema, sourceConfidence) => {
      resetTokenTracker();
      
      // Calculate completeness
      const score = calculateCompleteness(fields, schema, sourceConfidence);
      
      // Verify zero tokens consumed
      const stats = getTokenStats();
      expect(stats.total_tokens).toBe(0);
      
      // Verify score is valid
      expect(score.completeness).toBeGreaterThanOrEqual(0);
      expect(score.completeness).toBeLessThanOrEqual(1);
      expect(typeof score.meets_threshold).toBe('boolean');
    }), { numRuns: 20, timeout: 5000 });
  });
});

describe('Property 24: Token Minimization for Co-occurrence', () => {
  beforeEach(() => {
    resetTokenTracker();
  });

  /**
   * Property 24: For any co-occurrence relation generation,
   * zero LLM tokens should be consumed (pure statistical).
   */
  test('Property 24.1: Co-occurrence relation building consumes zero tokens', async () => {
    const ckbsArb = fc.array(
      fc.record({
        ckb_id: fc.string({ minLength: 10, maxLength: 20 }).filter(s => s.trim().length >= 10),
        entities: fc.array(
          fc.record({
            id: fc.string({ minLength: 10, maxLength: 30 }).filter(s => s.trim().length >= 10),
            canonical_name: fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length >= 5)
          }),
          { minLength: 2, maxLength: 5 }
        ),
        quality: fc.record({
          source_confidence: fc.float({ min: 0.5, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n) && n > 0)
        })
      }),
      { minLength: 1, maxLength: 10 }
    );

    const optionsArb = fc.record({
      weightThreshold: fc.float({ min: 0.3, max: 0.8 }).filter(n => !isNaN(n) && isFinite(n) && n > 0),
      minCooccurrences: fc.integer({ min: 1, max: 3 }),
      sourceWeight: fc.float({ min: 0.5, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n) && n > 0)
    });

    await fc.assert(fc.asyncProperty(ckbsArb, optionsArb, async (ckbs, options) => {
      resetTokenTracker();
      
      // Build co-occurrence relations
      const relations = await buildCooccurrenceRelations(ckbs, options);
      
      // Verify zero tokens consumed
      const stats = getTokenStats();
      expect(stats.total_tokens).toBe(0);
      expect(stats.total_input_tokens).toBe(0);
      expect(stats.total_output_tokens).toBe(0);
      
      // Verify relations are valid
      expect(Array.isArray(relations)).toBe(true);
      relations.forEach(rel => {
        expect(rel.type).toBe('co_occurrence');
        expect(rel.weight).toBeGreaterThan(0);
        expect(rel.confidence).toBeGreaterThanOrEqual(0);
        expect(rel.confidence).toBeLessThanOrEqual(1);
      });
    }), { numRuns: 15, timeout: 5000 });
  });

  test('Property 24.2: Co-occurrence with varying CKB counts consumes zero tokens', async () => {
    const ckbCountArb = fc.integer({ min: 1, max: 20 });
    const entitiesPerCkbArb = fc.integer({ min: 2, max: 6 });

    await fc.assert(fc.asyncProperty(ckbCountArb, entitiesPerCkbArb, async (ckbCount, entitiesPerCkb) => {
      resetTokenTracker();
      
      // Generate CKBs
      const ckbs = Array.from({ length: ckbCount }, (_, i) => ({
        ckb_id: `ckb_${i}`,
        entities: Array.from({ length: entitiesPerCkb }, (_, j) => ({
          id: `entity_${i}_${j}`,
          canonical_name: `Entity ${i}-${j}`
        })),
        quality: { source_confidence: 0.9 }
      }));
      
      // Build co-occurrence relations
      await buildCooccurrenceRelations(ckbs, { weightThreshold: 0.5 });
      
      // Verify zero tokens consumed
      const stats = getTokenStats();
      expect(stats.total_tokens).toBe(0);
    }), { numRuns: 15, timeout: 5000 });
  });
});

describe('Property 25: LLM Call Caching', () => {
  beforeEach(() => {
    clearCache();
    resetTokenTracker();
  });

  afterEach(() => {
    clearCache();
  });

  /**
   * Property 25: For any identical LLM query (same prompt and parameters),
   * the result should be retrieved from cache, avoiding redundant API calls.
   */
  test('Property 25.1: Identical prompts return cached results', () => {
    const promptArb = fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length >= 10);
    const optionsArb = fc.record({
      model: fc.constantFrom('gpt-4', 'gpt-3.5-turbo', 'qwen'),
      temperature: fc.float({ min: 0, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n)),
      max_tokens: fc.integer({ min: 100, max: 2000 })
    });
    const responseArb = fc.record({
      result: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
      tokens: fc.integer({ min: 50, max: 500 })
    });

    fc.assert(fc.property(promptArb, optionsArb, responseArb, (prompt, options, response) => {
      // Clear cache before each property test
      clearCache();
      
      // First call - cache miss
      const cached1 = get(prompt, options);
      expect(cached1).toBeNull();
      
      // Set cache
      set(prompt, options, response);
      
      // Second call - cache hit
      const cached2 = get(prompt, options);
      expect(cached2).toEqual(response);
      
      // Third call - cache hit
      const cached3 = get(prompt, options);
      expect(cached3).toEqual(response);
      
      // Verify cache stats
      const stats = getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hit_rate).toBeGreaterThan(0);
    }), { numRuns: 20, timeout: 5000 });
  });

  test('Property 25.2: Different prompts do not share cache', () => {
    const prompt1Arb = fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length >= 10);
    const prompt2Arb = fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length >= 10);
    const optionsArb = fc.record({
      model: fc.constantFrom('gpt-4', 'gpt-3.5-turbo'),
      temperature: fc.float({ min: 0, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n))
    });

    fc.assert(fc.property(prompt1Arb, prompt2Arb, optionsArb, (prompt1, prompt2, options) => {
      // Ensure prompts are different
      fc.pre(prompt1 !== prompt2);
      
      clearCache();
      
      // Cache first prompt
      set(prompt1, options, { result: 'response1' });
      
      // Try to get second prompt - should be cache miss
      const cached = get(prompt2, options);
      expect(cached).toBeNull();
      
      // Verify first prompt is still cached
      const cached1 = get(prompt1, options);
      expect(cached1).toEqual({ result: 'response1' });
    }), { numRuns: 15, timeout: 5000 });
  });

  test('Property 25.3: Cache hit rate increases with repeated queries', () => {
    const queriesArb = fc.array(
      fc.record({
        prompt: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length >= 10),
        options: fc.record({
          model: fc.constantFrom('gpt-4', 'gpt-3.5-turbo'),
          temperature: fc.constant(0.7)
        })
      }),
      { minLength: 5, maxLength: 10 }
    );
    const repeatCountArb = fc.integer({ min: 2, max: 5 });

    fc.assert(fc.property(queriesArb, repeatCountArb, (queries, repeatCount) => {
      clearCache();
      
      // First pass - cache all queries
      queries.forEach((query, i) => {
        set(query.prompt, query.options, { result: `response_${i}` });
      });
      
      // Repeat queries multiple times
      for (let i = 0; i < repeatCount; i++) {
        queries.forEach(query => {
          const cached = get(query.prompt, query.options);
          expect(cached).not.toBeNull();
        });
      }
      
      // Verify high hit rate
      const stats = getCacheStats();
      const expectedHits = queries.length * repeatCount;
      expect(stats.hits).toBe(expectedHits);
      expect(stats.hit_rate).toBeGreaterThan(90); // > 90% hit rate
    }), { numRuns: 10, timeout: 5000 });
  });

  test('Property 25.4: Cache saves tokens on repeated queries', () => {
    const promptArb = fc.string({ minLength: 20, maxLength: 100 }).filter(s => s.trim().length >= 20);
    const optionsArb = fc.record({
      model: fc.constant('gpt-4'),
      temperature: fc.constant(0.7)
    });
    const tokensPerCallArb = fc.integer({ min: 100, max: 500 });
    const repeatCountArb = fc.integer({ min: 2, max: 10 });

    fc.assert(fc.property(promptArb, optionsArb, tokensPerCallArb, repeatCountArb, (prompt, options, tokensPerCall, repeatCount) => {
      clearCache();
      
      // First call - cache miss, tokens consumed
      const response = { result: 'test', tokens: tokensPerCall };
      set(prompt, options, response);
      
      // Subsequent calls - cache hits, no tokens consumed
      for (let i = 0; i < repeatCount; i++) {
        const cached = get(prompt, options);
        expect(cached).toEqual(response);
      }
      
      // Verify token savings
      const stats = getCacheStats();
      
      // Cache tracks estimated token savings
      expect(stats.total_saved_tokens).toBeGreaterThan(0);
      expect(stats.hits).toBe(repeatCount);
    }), { numRuns: 15, timeout: 5000 });
  });
});

describe('Property 23-25: Combined Token Optimization', () => {
  beforeEach(() => {
    resetTokenTracker();
    clearCache();
  });

  test('Combined: Schema operations + Co-occurrence + Caching consume minimal tokens', async () => {
    const fieldsArb = fc.array(
      fc.record({
        name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
        value: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        type: fc.constantFrom('location', 'time', 'indicator', 'number', 'unit'),
        confidence: fc.float({ min: 0.5, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n) && n > 0)
      }),
      { minLength: 2, maxLength: 8 }
    );

    const schemasArb = fc.array(
      fc.record({
        schema_id: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5),
        schema_name: fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length >= 5),
        entity_type: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length >= 5),
        core_fields: fc.array(
          fc.record({
            name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
            weight: fc.float({ min: 0.1, max: 0.5 }).filter(n => !isNaN(n) && isFinite(n) && n > 0),
            required: fc.boolean()
          }),
          { minLength: 1, maxLength: 5 }
        ).map(fields => {
          // Ensure unique field names and normalize weights to sum <= 1
          const uniqueFields = [];
          const seenNames = new Set();
          for (const field of fields) {
            if (!seenNames.has(field.name) && field.weight > 0) {
              uniqueFields.push(field);
              seenNames.add(field.name);
            }
          }
          // Ensure at least one field
          if (uniqueFields.length === 0) {
            uniqueFields.push({ name: '区域', weight: 1.0, required: true });
          }
          // Normalize weights to sum to 1
          const totalWeight = uniqueFields.reduce((sum, f) => sum + f.weight, 0);
          if (totalWeight > 0) {
            uniqueFields.forEach(f => {
              f.weight = Math.max(0.01, f.weight / totalWeight);
            });
          }
          return uniqueFields;
        }),
        threshold: fc.float({ min: 0.5, max: 0.9 }).filter(n => !isNaN(n) && isFinite(n) && n > 0),
        relations: fc.constant([])
      }),
      { minLength: 1, maxLength: 3 }
    );

    const ckbsArb = fc.array(
      fc.record({
        ckb_id: fc.string({ minLength: 10, maxLength: 20 }).filter(s => s.trim().length >= 10),
        entities: fc.array(
          fc.record({
            id: fc.string({ minLength: 10, maxLength: 30 }).filter(s => s.trim().length >= 10),
            canonical_name: fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.trim().length >= 5)
          }),
          { minLength: 2, maxLength: 4 }
        ),
        quality: fc.record({
          source_confidence: fc.float({ min: 0.5, max: 1.0 }).filter(n => !isNaN(n) && isFinite(n) && n > 0)
        })
      }),
      { minLength: 1, maxLength: 5 }
    );

    await fc.assert(fc.asyncProperty(fieldsArb, schemasArb, ckbsArb, async (fields, schemas, ckbs) => {
      resetTokenTracker();
      clearCache();
      
      // Perform schema matching (0 tokens)
      matchSchemas(fields, schemas, 0.9);
      
      // Perform co-occurrence relation building (0 tokens)
      await buildCooccurrenceRelations(ckbs, { weightThreshold: 0.5 });
      
      // Verify zero tokens consumed for rule-based operations
      const stats = getTokenStats();
      expect(stats.total_tokens).toBe(0);
      
      // Simulate LLM calls with caching
      const prompt = 'Test prompt for entity enrichment';
      const options = { model: 'gpt-4', temperature: 0.7 };
      
      // First call - cache miss
      const response = { result: 'enriched entity data', tokens: 200 };
      set(prompt, options, response);
      
      // Second call - cache hit (saves tokens)
      const cached = get(prompt, options);
      expect(cached).toEqual(response);
      
      // Verify cache effectiveness
      const cacheStats = getCacheStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
      expect(cacheStats.total_saved_tokens).toBeGreaterThan(0);
    }), { numRuns: 10, timeout: 5000 });
  });
});
