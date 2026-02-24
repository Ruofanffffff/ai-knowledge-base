/**
 * Unit Tests for AI Enhancement Service
 * 
 * Tests all four AI enhancement features:
 * - Smart generation
 * - Smart proofreading
 * - Table generation
 * - Mind map generation
 */

const { AIEnhancementService, createAIEnhancementService } = require('./aiEnhancementService');
const { createTextLLMClient } = require('./llmClient');

// Mock the LLM client
jest.mock('./llmClient');

describe('AIEnhancementService', () => {
  let service;
  let mockLLMClient;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generateJSON: jest.fn(),
      getStats: jest.fn(() => ({
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalTokens: 0,
        successRate: 0
      })),
      resetStats: jest.fn()
    };

    createTextLLMClient.mockReturnValue(mockLLMClient);

    // Create service
    service = new AIEnhancementService({
      apiKey: 'test-key',
      timeout: 5000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Smart Generation', () => {
    it('should expand text and generate image prompt', async () => {
      // Mock LLM response
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          expandedText: 'This is an expanded version of the original text with more details and descriptions.',
          imagePrompt: 'A beautiful landscape with mountains and rivers, photorealistic, 4k, detailed'
        },
        tokens: 150,
        model: 'qwen-max'
      });

      const result = await service.generate({
        text: 'A beautiful landscape'
      });

      expect(result).toHaveProperty('expandedText');
      expect(result).toHaveProperty('imagePrompt');
      expect(result.expandedText).toContain('expanded');
      expect(result.imagePrompt).toContain('landscape');
      expect(result.tokens).toBe(150);
      expect(mockLLMClient.generateJSON).toHaveBeenCalledTimes(1);
    });

    it('should support context and style options', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          expandedText: 'Professional expanded text',
          imagePrompt: 'Professional image prompt'
        },
        tokens: 100,
        model: 'qwen-max'
      });

      await service.generate({
        text: 'Test text',
        context: 'Business context',
        style: 'professional'
      });

      const callArgs = mockLLMClient.generateJSON.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Business context');
      expect(callArgs.prompt).toContain('专业');
    });

    it('should throw error for empty text', async () => {
      await expect(service.generate({ text: '' }))
        .rejects.toThrow('must be a non-empty string');
    });

    it('should throw error for invalid output format', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          expandedText: 'Text only'
          // Missing imagePrompt
        },
        tokens: 50,
        model: 'qwen-max'
      });

      await expect(service.generate({ text: 'Test' }))
        .rejects.toThrow('imagePrompt');
    });

    it('should handle timeout', async () => {
      mockLLMClient.generateJSON.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      await expect(service.generate({ text: 'Test' }))
        .rejects.toThrow('timed out');
    }, 10000); // Increase test timeout
  });

  describe('Smart Proofreading', () => {
    it('should correct text and track changes', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          correctedText: 'This is the corrected text.',
          changes: [
            {
              type: 'spelling',
              original: 'teh',
              corrected: 'the',
              position: { start: 8, end: 11 },
              reason: 'Spelling error'
            }
          ]
        },
        tokens: 120,
        model: 'qwen-max'
      });

      const result = await service.proofread({
        text: 'This is teh text.'
      });

      expect(result).toHaveProperty('correctedText');
      expect(result).toHaveProperty('changes');
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('spelling');
      expect(result.changes[0].original).toBe('teh');
      expect(result.changes[0].corrected).toBe('the');
    });

    it('should support language option', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          correctedText: 'Corrected English text.',
          changes: []
        },
        tokens: 80,
        model: 'qwen-max'
      });

      await service.proofread({
        text: 'English text',
        language: 'en'
      });

      const callArgs = mockLLMClient.generateJSON.mock.calls[0][0];
      expect(callArgs.prompt).toContain('English');
    });

    it('should handle text with no errors', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          correctedText: 'Perfect text.',
          changes: []
        },
        tokens: 50,
        model: 'qwen-max'
      });

      const result = await service.proofread({
        text: 'Perfect text.'
      });

      expect(result.correctedText).toBe('Perfect text.');
      expect(result.changes).toHaveLength(0);
    });

    it('should validate change types', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          correctedText: 'Text',
          changes: [
            {
              type: 'invalid-type',
              original: 'a',
              corrected: 'b'
            }
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      await expect(service.proofread({ text: 'Test' }))
        .rejects.toThrow('invalid type');
    });
  });

  describe('Table Generation', () => {
    it('should generate table from text', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          headers: ['Name', 'Age', 'City'],
          rows: [
            ['Alice', '25', 'New York'],
            ['Bob', '30', 'London']
          ],
          notes: 'Generated from text'
        },
        tokens: 200,
        model: 'qwen-max'
      });

      const result = await service.generateTable({
        text: 'Alice is 25 and lives in New York. Bob is 30 and lives in London.'
      });

      expect(result).toHaveProperty('table');
      expect(result.table.headers).toEqual(['Name', 'Age', 'City']);
      expect(result.table.rows).toHaveLength(2);
      expect(result.table.rows[0]).toEqual(['Alice', '25', 'New York']);
    });

    it('should support maxColumns option', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          headers: ['Col1', 'Col2'],
          rows: [['A', 'B']]
        },
        tokens: 100,
        model: 'qwen-max'
      });

      await service.generateTable({
        text: 'Test data',
        maxColumns: 5
      });

      const callArgs = mockLLMClient.generateJSON.mock.calls[0][0];
      expect(callArgs.prompt).toContain('5列');
    });

    it('should validate table structure - headers required', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          rows: [['A', 'B']]
          // Missing headers
        },
        tokens: 50,
        model: 'qwen-max'
      });

      await expect(service.generateTable({ text: 'Test' }))
        .rejects.toThrow('headers');
    });

    it('should validate table structure - consistent row lengths', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          headers: ['A', 'B', 'C'],
          rows: [
            ['1', '2', '3'],
            ['4', '5'] // Wrong length
          ]
        },
        tokens: 100,
        model: 'qwen-max'
      });

      await expect(service.generateTable({ text: 'Test' }))
        .rejects.toThrow('expected 3');
    });

    it('should validate all cells are strings', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          headers: ['A', 'B'],
          rows: [
            ['1', 2] // Number instead of string
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      await expect(service.generateTable({ text: 'Test' }))
        .rejects.toThrow('must be a string');
    });
  });

  describe('Mind Map Generation', () => {
    it('should generate mind map from text with central_topic and nodes', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Main Topic',
          nodes: [
            {
              id: '1',
              text: 'Branch 1',
              children: [
                { id: '1-1', text: 'Sub 1.1' },
                { id: '1-2', text: 'Sub 1.2' }
              ]
            },
            {
              id: '2',
              text: 'Branch 2',
              children: [
                { id: '2-1', text: 'Sub 2.1' }
              ]
            },
            {
              id: '3',
              text: 'Branch 3'
            }
          ]
        },
        tokens: 180,
        model: 'qwen-max'
      });

      const result = await service.generateMindMap({
        text: 'A complex topic with multiple aspects and subtopics.'
      });

      // Requirement 2.8: return { mindmap: { central_topic, nodes }, tokens, model }
      expect(result).toHaveProperty('mindmap');
      expect(result).toHaveProperty('tokens', 180);
      expect(result).toHaveProperty('model', 'qwen-max');
      expect(result.mindmap.central_topic).toBe('Main Topic');
      expect(result.mindmap.nodes).toHaveLength(3);
      expect(result.mindmap.nodes[0].id).toBe('1');
      expect(result.mindmap.nodes[0].text).toBe('Branch 1');
      expect(result.mindmap.nodes[0].children).toHaveLength(2);
    });

    it('should support maxBranches and maxDepth options', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: [
            { id: '1', text: 'B1' },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' },
            { id: '4', text: 'B4' }
          ]
        },
        tokens: 100,
        model: 'qwen-max'
      });

      await service.generateMindMap({
        text: 'Test topic',
        maxBranches: 4,
        maxDepth: 2
      });

      const callArgs = mockLLMClient.generateJSON.mock.calls[0][0];
      expect(callArgs.prompt).toContain('3-4');
      expect(callArgs.prompt).toContain('2 层');
    });

    it('should validate branch count too few (< 3)', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: [
            { id: '1', text: 'B1' },
            { id: '2', text: 'B2' }
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.6: nodes < 3 or > 6 should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('一级分支数量应为 3-6 个');
    });

    it('should validate branch count too many (> 6)', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: [
            { id: '1', text: 'B1' },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' },
            { id: '4', text: 'B4' },
            { id: '5', text: 'B5' },
            { id: '6', text: 'B6' },
            { id: '7', text: 'B7' }
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.6: nodes > 6 should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('一级分支数量应为 3-6 个');
    });

    it('should validate node text length (max 20 characters)', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: [
            { id: '1', text: 'This is a very long text that exceeds twenty characters' },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' }
          ]
        },
        tokens: 100,
        model: 'qwen-max'
      });

      // Requirement 2.5: text > 20 chars should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('节点文本过长');
    });

    it('should validate nested children node text length', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: [
            {
              id: '1',
              text: 'B1',
              children: [
                { id: '1-1', text: 'This text is way too long for a mind map node' }
              ]
            },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' }
          ]
        },
        tokens: 100,
        model: 'qwen-max'
      });

      // Requirement 2.7: recursive children validation
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('节点文本过长');
    });

    it('should require central_topic field as non-empty string', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          nodes: [
            { id: '1', text: 'B1' },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' }
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.2: missing central_topic should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('central_topic');
    });

    it('should reject empty string central_topic', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: '',
          nodes: [
            { id: '1', text: 'B1' },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' }
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.2: empty string central_topic should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('central_topic');
    });

    it('should reject non-array nodes', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: 'not an array'
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.3: non-array nodes should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('nodes');
    });

    it('should reject empty nodes array', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: []
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.3: empty nodes array should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('nodes');
    });

    it('should reject node missing id field', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: [
            { text: 'B1' },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' }
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.4: node without id should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('id');
    });

    it('should reject node missing text field', async () => {
      mockLLMClient.generateJSON.mockResolvedValue({
        data: {
          central_topic: 'Topic',
          nodes: [
            { id: '1' },
            { id: '2', text: 'B2' },
            { id: '3', text: 'B3' }
          ]
        },
        tokens: 50,
        model: 'qwen-max'
      });

      // Requirement 2.4: node without text should throw
      await expect(service.generateMindMap({ text: 'Test' }))
        .rejects.toThrow('text');
    });
  });

  describe('Factory Function', () => {
    it('should create service instance', () => {
      const instance = createAIEnhancementService({ apiKey: 'test' });
      expect(instance).toBeInstanceOf(AIEnhancementService);
    });
  });

  describe('Statistics', () => {
    it('should get statistics from LLM client', () => {
      const stats = service.getStats();
      expect(stats).toHaveProperty('totalCalls');
      expect(stats).toHaveProperty('successRate');
      expect(mockLLMClient.getStats).toHaveBeenCalled();
    });

    it('should reset statistics', () => {
      service.resetStats();
      expect(mockLLMClient.resetStats).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM client errors', async () => {
      mockLLMClient.generateJSON.mockRejectedValue(new Error('LLM error'));

      await expect(service.generate({ text: 'Test' }))
        .rejects.toThrow('Smart generation failed');
    });

    it('should handle JSON parsing errors', async () => {
      mockLLMClient.generateJSON.mockRejectedValue(new Error('JSON parse error'));

      await expect(service.generateTable({ text: 'Test' }))
        .rejects.toThrow('Table generation failed');
    });
  });
});
