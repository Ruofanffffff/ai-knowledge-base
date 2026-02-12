/**
 * Property-based tests for IndexGenerator
 * 
 * **Feature: llm-document-index-preprocessing, Property 2: 索引完整性**
 * **Validates: Requirements 1.2**
 * 
 * Property: For any generated Document_Index, it should contain all required fields:
 * - indexed_text (non-empty string)
 * - metadata with generated_at, llm_model, token_count, fact_count
 * - doc_id
 * - version
 */

const fc = require('fast-check');
const { IndexGenerator } = require('../index_generator');

describe('IndexGenerator Property Tests', () => {
  let generator;
  let mockLLMClient;

  beforeEach(() => {
    generator = new IndexGenerator();
    
    // Mock LLM client
    mockLLMClient = {
      call: jest.fn()
    };
  });

  /**
   * Property 2: 索引完整性
   * For any generated Document_Index, it should contain all required fields
   */
  describe('Property 2: Index Completeness', () => {
    it('should always generate complete document index with all required fields', async () => {
      // Arbitraries for test data generation
      const docIdArb = fc.uuid();
      const textArb = fc.string({ minLength: 50, maxLength: 500 });
      const factCountArb = fc.integer({ min: 1, max: 10 });

      await fc.assert(
        fc.asyncProperty(docIdArb, textArb, factCountArb, async (docId, text, factCount) => {
          // Setup mock LLM response
          const facts = Array.from({ length: factCount }, (_, i) => 
            `${i + 1}. 这是第${i + 1}个事实。`
          ).join('\n');
          
          mockLLMClient.call.mockResolvedValue({
            content: `【索引叙述文本】\n${facts}`,
            tokens: 100 + factCount * 10,
            input_tokens: 50,
            output_tokens: 50 + factCount * 10,
            model: 'qwen-plus'
          });

          // Generate index
          const result = await generator.generateIndexedText(docId, text, mockLLMClient);

          // Property: Result must have all required fields
          expect(result).toHaveProperty('id');
          expect(result).toHaveProperty('doc_id');
          expect(result).toHaveProperty('indexed_text');
          expect(result).toHaveProperty('metadata');
          expect(result).toHaveProperty('version');
          expect(result).toHaveProperty('created_at');

          // Property: doc_id must match input
          expect(result.doc_id).toBe(docId);

          // Property: indexed_text must be non-empty
          expect(result.indexed_text).toBeTruthy();
          expect(result.indexed_text.length).toBeGreaterThan(0);

          // Property: metadata must contain required fields
          expect(result.metadata).toHaveProperty('generated_at');
          expect(result.metadata).toHaveProperty('llm_model');
          expect(result.metadata).toHaveProperty('token_count');
          expect(result.metadata).toHaveProperty('fact_count');
          expect(result.metadata).toHaveProperty('generation_time_ms');

          // Property: metadata values must be valid
          expect(result.metadata.generated_at).toBeTruthy();
          expect(result.metadata.llm_model).toBeTruthy();
          expect(result.metadata.token_count).toBeGreaterThanOrEqual(0);
          expect(result.metadata.fact_count).toBeGreaterThanOrEqual(0);
          expect(result.metadata.generation_time_ms).toBeGreaterThanOrEqual(0);

          // Property: version must be positive integer
          expect(result.version).toBeGreaterThan(0);
          expect(Number.isInteger(result.version)).toBe(true);

          // Property: created_at must be a valid date
          expect(result.created_at).toBeInstanceOf(Date);
          expect(result.created_at.getTime()).toBeLessThanOrEqual(Date.now());
        }),
        { numRuns: 100 }
      );
    });

    it('should always generate indexed_text with numbered list format', async () => {
      const docIdArb = fc.uuid();
      const textArb = fc.string({ minLength: 50, maxLength: 500 });

      await fc.assert(
        fc.asyncProperty(docIdArb, textArb, async (docId, text) => {
          // Setup mock LLM response with numbered list
          mockLLMClient.call.mockResolvedValue({
            content: `【索引叙述文本】
1. 第一个事实。
2. 第二个事实。
3. 第三个事实。`,
            tokens: 120,
            model: 'qwen-plus'
          });

          const result = await generator.generateIndexedText(docId, text, mockLLMClient);

          // Property: indexed_text must contain numbered list format
          const hasNumberedList = /^\d+\.\s+/m.test(result.indexed_text);
          expect(hasNumberedList).toBe(true);

          // Property: fact_count must match parsed facts
          const facts = generator.parseIndexedText(result.indexed_text);
          expect(result.metadata.fact_count).toBe(facts.length);
          expect(facts.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should always preserve document ID in result', async () => {
      const docIdArb = fc.uuid();
      const textArb = fc.string({ minLength: 20, maxLength: 200 });

      await fc.assert(
        fc.asyncProperty(docIdArb, textArb, async (docId, text) => {
          mockLLMClient.call.mockResolvedValue({
            content: `1. 测试事实。`,
            tokens: 50,
            model: 'qwen-plus'
          });

          const result = await generator.generateIndexedText(docId, text, mockLLMClient);

          // Property: doc_id must always match input
          expect(result.doc_id).toBe(docId);
        }),
        { numRuns: 100 }
      );
    });

    it('should always generate unique IDs for different calls', async () => {
      const docIdArb = fc.uuid();
      const textArb = fc.string({ minLength: 20, maxLength: 200 });

      await fc.assert(
        fc.asyncProperty(docIdArb, textArb, async (docId, text) => {
          mockLLMClient.call.mockResolvedValue({
            content: `1. 测试事实。`,
            tokens: 50,
            model: 'qwen-plus'
          });

          const result1 = await generator.generateIndexedText(docId, text, mockLLMClient);
          const result2 = await generator.generateIndexedText(docId, text, mockLLMClient);

          // Property: Each generation should have unique ID
          expect(result1.id).not.toBe(result2.id);
          
          // But same doc_id
          expect(result1.doc_id).toBe(result2.doc_id);
        }),
        { numRuns: 50 }
      );
    });

    it('should always have non-negative token counts', async () => {
      const docIdArb = fc.uuid();
      const textArb = fc.string({ minLength: 20, maxLength: 200 });
      const tokenCountArb = fc.integer({ min: 0, max: 5000 });

      await fc.assert(
        fc.asyncProperty(docIdArb, textArb, tokenCountArb, async (docId, text, tokens) => {
          mockLLMClient.call.mockResolvedValue({
            content: `1. 测试事实。`,
            tokens: tokens,
            input_tokens: Math.floor(tokens * 0.6),
            output_tokens: Math.floor(tokens * 0.4),
            model: 'qwen-plus'
          });

          const result = await generator.generateIndexedText(docId, text, mockLLMClient);

          // Property: All token counts must be non-negative
          expect(result.metadata.token_count).toBeGreaterThanOrEqual(0);
          expect(result.metadata.input_tokens).toBeGreaterThanOrEqual(0);
          expect(result.metadata.output_tokens).toBeGreaterThanOrEqual(0);
          
          // Property: Total tokens should equal sum of input and output (or be the provided total)
          // Note: LLM might return total_tokens directly or we calculate it
          const expectedTotal = result.metadata.input_tokens + result.metadata.output_tokens;
          expect(result.metadata.token_count).toBeGreaterThanOrEqual(expectedTotal);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Validation consistency
   * Validation results should be consistent with parsed content
   */
  describe('Property: Validation Consistency', () => {
    it('should have consistent validation and parsing results', () => {
      const indexedTextArb = fc.array(
        fc.string({ minLength: 10, maxLength: 100 }),
        { minLength: 1, maxLength: 10 }
      ).map((facts, index) => 
        facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')
      );

      fc.assert(
        fc.property(indexedTextArb, (indexedText) => {
          const validation = generator.validateIndexedText(indexedText);
          const facts = generator.parseIndexedText(indexedText);

          // Property: fact_count in validation must match parsed facts
          expect(validation.fact_count).toBe(facts.length);

          // Property: If facts exist, validation should pass basic checks
          if (facts.length > 0) {
            expect(validation.fact_count).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should always parse valid numbered lists correctly', () => {
      const factCountArb = fc.integer({ min: 1, max: 20 });
      const factTextArb = fc.string({ minLength: 5, maxLength: 50 });

      fc.assert(
        fc.property(factCountArb, factTextArb, (count, baseText) => {
          // Generate valid numbered list
          const indexedText = Array.from({ length: count }, (_, i) => 
            `${i + 1}. ${baseText} ${i + 1}`
          ).join('\n');

          const facts = generator.parseIndexedText(indexedText);

          // Property: Should parse all facts
          expect(facts.length).toBe(count);

          // Property: Indices should be sequential
          facts.forEach((fact, i) => {
            expect(fact.index).toBe(i + 1);
          });

          // Property: All facts should have text
          facts.forEach(fact => {
            expect(fact.text).toBeTruthy();
            expect(fact.text.length).toBeGreaterThan(0);
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Entity extraction consistency
   * Extracted entities should always reference valid fact indices
   */
  describe('Property: Entity Extraction Consistency', () => {
    it('should always extract entities with valid source indices', () => {
      const factCountArb = fc.integer({ min: 1, max: 10 });

      fc.assert(
        fc.property(factCountArb, (count) => {
          // Generate indexed text with entities
          const indexedText = Array.from({ length: count }, (_, i) => 
            `${i + 1}. 2025年1月，位于海南省的监测点显示数据为45.2米。`
          ).join('\n');

          const facts = generator.parseIndexedText(indexedText);
          const entities = generator.extractKeyEntities(indexedText);

          // Property: All entity source_index must be valid fact indices
          entities.forEach(entity => {
            expect(entity.source_index).toBeGreaterThanOrEqual(1);
            expect(entity.source_index).toBeLessThanOrEqual(facts.length);
            
            // Property: Source index must correspond to an actual fact
            const fact = facts.find(f => f.index === entity.source_index);
            expect(fact).toBeDefined();
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Relation extraction consistency
   * Extracted relations should always reference valid fact indices
   */
  describe('Property: Relation Extraction Consistency', () => {
    it('should always extract relations with valid source indices', () => {
      const factCountArb = fc.integer({ min: 1, max: 10 });

      fc.assert(
        fc.property(factCountArb, (count) => {
          // Generate indexed text with relations
          const indexedText = Array.from({ length: count }, (_, i) => 
            `${i + 1}. 阿里C区位于海南省海口市美兰区。`
          ).join('\n');

          const facts = generator.parseIndexedText(indexedText);
          const relations = generator.extractKeyRelations(indexedText);

          // Property: All relation source_index must be valid fact indices
          relations.forEach(relation => {
            expect(relation.source_index).toBeGreaterThanOrEqual(1);
            expect(relation.source_index).toBeLessThanOrEqual(facts.length);
            
            // Property: Source index must correspond to an actual fact
            const fact = facts.find(f => f.index === relation.source_index);
            expect(fact).toBeDefined();
          });
        }),
        { numRuns: 100 }
      );
    });
  });
});
