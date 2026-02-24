/**
 * Property-Based Tests for AI Enhancement Service
 * 
 * Tests correctness properties 8-13:
 * - Property 8: Smart generation output format
 * - Property 9: Smart proofreading preserves meaning
 * - Property 10: Table generation JSON validity
 * - Property 11: Table structure reasonableness
 * - Property 12: Mind map structure completeness (central_topic + nodes format)
 * - Property 13: Mind map JSON validity (central_topic + nodes with id/text/children)
 * 
 * Feature: notes-feature
 */

const fc = require('fast-check');
const { AIEnhancementService } = require('./aiEnhancementService');
const { createTextLLMClient } = require('./llmClient');

// Mock the LLM client
jest.mock('./llmClient');

describe('AIEnhancementService - Property-Based Tests', () => {
  let service;
  let mockLLMClient;

  beforeEach(() => {
    mockLLMClient = {
      generateJSON: jest.fn(),
      getStats: jest.fn(() => ({ totalCalls: 0, successfulCalls: 0, failedCalls: 0, totalTokens: 0, successRate: 0 })),
      resetStats: jest.fn()
    };

    createTextLLMClient.mockReturnValue(mockLLMClient);
    service = new AIEnhancementService({ apiKey: 'test-key', timeout: 5000 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 8: Smart generation output format
   * **Validates: Requirements 5.3, 5.4**
   * 
   * For any text expansion request, the AI enhancer's output should contain
   * both expandedText and imagePrompt fields.
   */
  describe('Property 8: Smart generation output format', () => {
    it('should always return expandedText and imagePrompt for any input text', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          async (text) => {
            // Mock LLM to return valid response
            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                expandedText: `Expanded: ${text}. This is a longer version with more details.`,
                imagePrompt: `Image prompt for: ${text}, photorealistic, detailed`
              },
              tokens: 100,
              model: 'qwen-max'
            });

            const result = await service.generate({ text });

            // Property: Output must have both fields
            expect(result).toHaveProperty('expandedText');
            expect(result).toHaveProperty('imagePrompt');
            expect(typeof result.expandedText).toBe('string');
            expect(typeof result.imagePrompt).toBe('string');
            expect(result.expandedText.length).toBeGreaterThan(0);
            expect(result.imagePrompt.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject output missing expandedText field', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (text) => {
            // Mock LLM to return invalid response (missing expandedText)
            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                imagePrompt: 'Some prompt'
              },
              tokens: 50,
              model: 'qwen-max'
            });

            await expect(service.generate({ text }))
              .rejects.toThrow('expandedText');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject output missing imagePrompt field', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (text) => {
            // Mock LLM to return invalid response (missing imagePrompt)
            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                expandedText: 'Some text'
              },
              tokens: 50,
              model: 'qwen-max'
            });

            await expect(service.generate({ text }))
              .rejects.toThrow('imagePrompt');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 9: Smart proofreading preserves meaning
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   * 
   * For any text without obvious errors, smart proofreading should return
   * text that is semantically equivalent to the original.
   */
  describe('Property 9: Smart proofreading preserves meaning', () => {
    it('should preserve text without errors', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (text) => {
            // Mock LLM to return text unchanged (no errors found)
            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                correctedText: text,
                changes: []
              },
              tokens: 80,
              model: 'qwen-max'
            });

            const result = await service.proofread({ text });

            // Property: If no changes, corrected text should equal original
            if (result.changes.length === 0) {
              expect(result.correctedText).toBe(text);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return valid change tracking structure', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.record({
            type: fc.constantFrom('spelling', 'grammar', 'punctuation', 'word-choice'),
            original: fc.string({ minLength: 1, maxLength: 20 }),
            corrected: fc.string({ minLength: 1, maxLength: 20 }),
            position: fc.record({
              start: fc.nat(200),
              end: fc.nat(200)
            }),
            reason: fc.string({ maxLength: 100 })
          }), { maxLength: 10 }),
          async (text, changes) => {
            // Mock LLM to return with changes
            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                correctedText: text,
                changes
              },
              tokens: 100,
              model: 'qwen-max'
            });

            const result = await service.proofread({ text });

            // Property: Changes must be an array
            expect(Array.isArray(result.changes)).toBe(true);
            
            // Property: Each change must have valid type
            result.changes.forEach(change => {
              expect(['spelling', 'grammar', 'punctuation', 'word-choice']).toContain(change.type);
              expect(typeof change.original).toBe('string');
              expect(typeof change.corrected).toBe('string');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Table generation JSON validity
   * **Validates: Requirements 7.4**
   * 
   * For any table generation request, output should be valid JSON format
   * with headers and rows fields.
   */
  describe('Property 10: Table generation JSON validity', () => {
    it('should always return valid JSON with headers and rows', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 300 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          async (text, headers) => {
            // Generate rows with same length as headers
            const rows = Array.from({ length: 3 }, () =>
              headers.map((_, i) => `data${i}`)
            );

            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                headers,
                rows,
                notes: 'Generated table'
              },
              tokens: 150,
              model: 'qwen-max'
            });

            const result = await service.generateTable({ text });

            // Property: Must have table object with headers and rows
            expect(result).toHaveProperty('table');
            expect(result.table).toHaveProperty('headers');
            expect(result.table).toHaveProperty('rows');
            expect(Array.isArray(result.table.headers)).toBe(true);
            expect(Array.isArray(result.table.rows)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid table structures', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (text) => {
            // Mock LLM to return invalid structure (missing headers)
            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                rows: [['A', 'B']]
              },
              tokens: 50,
              model: 'qwen-max'
            });

            await expect(service.generateTable({ text }))
              .rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 11: Table structure reasonableness
   * **Validates: Requirements 7.2**
   * 
   * For any generated table, the length of headers array should equal
   * the length of each row array.
   */
  describe('Property 11: Table structure reasonableness', () => {
    it('should ensure all rows have same length as headers', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 20 }),
          async (text, numColumns, numRows) => {
            // Generate consistent table structure
            const headers = Array.from({ length: numColumns }, (_, i) => `Col${i + 1}`);
            const rows = Array.from({ length: numRows }, (_, i) =>
              Array.from({ length: numColumns }, (_, j) => `R${i}C${j}`)
            );

            mockLLMClient.generateJSON.mockResolvedValue({
              data: { headers, rows },
              tokens: 150,
              model: 'qwen-max'
            });

            const result = await service.generateTable({ text });

            // Property: All rows must have same length as headers
            const headerLength = result.table.headers.length;
            result.table.rows.forEach((row, index) => {
              expect(row.length).toBe(headerLength);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject tables with inconsistent row lengths', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 2, max: 5 }),
          async (text, numColumns) => {
            const headers = Array.from({ length: numColumns }, (_, i) => `Col${i}`);
            const inconsistentRows = [
              Array.from({ length: numColumns }, (_, i) => `data${i}`),
              Array.from({ length: numColumns - 1 }, (_, i) => `data${i}`) // Wrong length
            ];

            mockLLMClient.generateJSON.mockResolvedValue({
              data: { headers, rows: inconsistentRows },
              tokens: 100,
              model: 'qwen-max'
            });

            await expect(service.generateTable({ text }))
              .rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 12: Mind map structure completeness
   * **Validates: Requirements 2.2, 2.3, 2.6**
   * 
   * For any mind map generation request, output should contain central_topic
   * and 3-6 first-level nodes, with each node text being reasonable length (≤20 chars).
   */
  describe('Property 12: Mind map structure completeness', () => {
    it('should always have central_topic and 3-6 nodes', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 300 }),
          fc.integer({ min: 3, max: 6 }),
          async (text, numNodes) => {
            const nodes = Array.from({ length: numNodes }, (_, i) => ({
              id: `${i + 1}`,
              text: `Node ${i + 1}`,
              children: [
                { id: `${i + 1}-1`, text: `Sub ${i}.1` },
                { id: `${i + 1}-2`, text: `Sub ${i}.2` }
              ]
            }));

            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                central_topic: 'Main Topic',
                nodes
              },
              tokens: 180,
              model: 'qwen-max'
            });

            const result = await service.generateMindMap({ text });

            // Property: Must have central_topic and nodes
            expect(result.mindmap).toHaveProperty('central_topic');
            expect(result.mindmap).toHaveProperty('nodes');
            expect(typeof result.mindmap.central_topic).toBe('string');
            expect(Array.isArray(result.mindmap.nodes)).toBe(true);
            
            // Property: Must have 3-6 nodes
            expect(result.mindmap.nodes.length).toBeGreaterThanOrEqual(3);
            expect(result.mindmap.nodes.length).toBeLessThanOrEqual(6);
            
            // Property: All node texts should be reasonable length (≤20 chars)
            result.mindmap.nodes.forEach(node => {
              expect(node.text.length).toBeLessThanOrEqual(20);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject mind maps with too few nodes', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 2 }),
          async (text, numNodes) => {
            const nodes = Array.from({ length: numNodes }, (_, i) => ({
              id: `${i + 1}`,
              text: `Node ${i}`
            }));

            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                central_topic: 'Topic',
                nodes
              },
              tokens: 80,
              model: 'qwen-max'
            });

            await expect(service.generateMindMap({ text }))
              .rejects.toThrow('一级分支数量应为 3-6 个');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject mind maps with too many nodes', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 7, max: 10 }),
          async (text, numNodes) => {
            const nodes = Array.from({ length: numNodes }, (_, i) => ({
              id: `${i + 1}`,
              text: `Node ${i}`
            }));

            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                central_topic: 'Topic',
                nodes
              },
              tokens: 100,
              model: 'qwen-max'
            });

            await expect(service.generateMindMap({ text }))
              .rejects.toThrow('一级分支数量应为 3-6 个');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject nodes with text exceeding 20 characters', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (text) => {
            const nodes = [
              { id: '1', text: 'This is a very long text that exceeds the twenty character limit' },
              { id: '2', text: 'N2' },
              { id: '3', text: 'N3' }
            ];

            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                central_topic: 'Topic',
                nodes
              },
              tokens: 100,
              model: 'qwen-max'
            });

            await expect(service.generateMindMap({ text }))
              .rejects.toThrow('节点文本过长');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 13: Mind map JSON validity
   * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.7**
   * 
   * For any mind map generation request, output should be valid JSON format
   * with central_topic and nodes fields, and nodes should be valid hierarchical structure
   * with id and text fields.
   */
  describe('Property 13: Mind map JSON validity', () => {
    it('should always return valid JSON with central_topic and nodes', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 300 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 3, max: 6 }),
          async (text, centralTopic, numNodes) => {
            const nodes = Array.from({ length: numNodes }, (_, i) => ({
              id: `${i + 1}`,
              text: `N${i + 1}`,
              children: i % 2 === 0 ? [{ id: `${i + 1}-1`, text: `S${i}.1` }] : undefined
            }));

            mockLLMClient.generateJSON.mockResolvedValue({
              data: { central_topic: centralTopic, nodes },
              tokens: 150,
              model: 'qwen-max'
            });

            const result = await service.generateMindMap({ text });

            // Property: Must have valid structure
            expect(result.mindmap).toHaveProperty('central_topic');
            expect(result.mindmap).toHaveProperty('nodes');
            expect(typeof result.mindmap.central_topic).toBe('string');
            expect(Array.isArray(result.mindmap.nodes)).toBe(true);
            
            // Property: Each node must have id and text
            result.mindmap.nodes.forEach(node => {
              expect(node).toHaveProperty('id');
              expect(typeof node.id).toBe('string');
              expect(node).toHaveProperty('text');
              expect(typeof node.text).toBe('string');
              
              // If children exist, they must be valid array
              if (node.children) {
                expect(Array.isArray(node.children)).toBe(true);
                node.children.forEach(child => {
                  expect(child).toHaveProperty('id');
                  expect(typeof child.id).toBe('string');
                  expect(child).toHaveProperty('text');
                  expect(typeof child.text).toBe('string');
                });
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject mind maps missing central_topic field', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (text) => {
            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                nodes: [
                  { id: '1', text: 'N1' },
                  { id: '2', text: 'N2' },
                  { id: '3', text: 'N3' }
                ]
              },
              tokens: 80,
              model: 'qwen-max'
            });

            await expect(service.generateMindMap({ text }))
              .rejects.toThrow('central_topic');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should validate hierarchical structure recursively', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }),
          async (text) => {
            const nodes = [
              {
                id: '1',
                text: 'N1',
                children: [
                  {
                    id: '1-1',
                    text: 'S1.1',
                    children: [
                      { id: '1-1-1', text: 'SS1.1.1' }
                    ]
                  }
                ]
              },
              { id: '2', text: 'N2' },
              { id: '3', text: 'N3' }
            ];

            mockLLMClient.generateJSON.mockResolvedValue({
              data: {
                central_topic: 'Topic',
                nodes
              },
              tokens: 150,
              model: 'qwen-max'
            });

            const result = await service.generateMindMap({ text });

            // Property: Nested structure should be valid
            const validateNode = (node) => {
              expect(node).toHaveProperty('id');
              expect(typeof node.id).toBe('string');
              expect(node).toHaveProperty('text');
              expect(typeof node.text).toBe('string');
              if (node.children) {
                expect(Array.isArray(node.children)).toBe(true);
                node.children.forEach(validateNode);
              }
            };

            result.mindmap.nodes.forEach(validateNode);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
