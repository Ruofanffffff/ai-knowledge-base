/**
 * ThemeDiscoveryEngine 单元测试
 */

// Mock Prisma - must be before require
const mockPrisma = {
  cognitiveFragment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  knowledgeBody: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  themeDiscoveryLog: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  themeEvolutionLog: {
    create: jest.fn(),
  },
  unifiedEntity: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock EmbeddingService
jest.mock('./embeddingService', () => ({
  generateEmbedding: jest.fn(),
  cosineSimilarity: jest.fn(),
  findSimilar: jest.fn(),
}));

// Mock LLMClient
jest.mock('./llmClient', () => ({
  call: jest.fn(),
  callJSON: jest.fn(),
}));

// Mock IntentAggregationService
const mockIntentAggregationService = {
  assignFragment: jest.fn(),
  aggregateBodies: jest.fn(),
  calculateIntentConfidence: jest.fn(),
};
jest.mock('./intentAggregationService', () => mockIntentAggregationService);

// Mock LifecycleService
const mockLifecycleService = {
  runLifecycleScan: jest.fn(),
  reactivateBody: jest.fn(),
};
jest.mock('./lifecycleService', () => mockLifecycleService);

const { ThemeDiscoveryEngine } = require('./themeDiscoveryEngine');
const embeddingService = require('./embeddingService');
const llmClient = require('./llmClient');

describe('ThemeDiscoveryEngine', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
    // Default: assignFragment returns null (no match), aggregateBodies returns empty result
    mockIntentAggregationService.assignFragment.mockResolvedValue(null);
    mockIntentAggregationService.aggregateBodies.mockResolvedValue({ intentBodiesCreated: 0, bodiesMerged: 0, errors: [] });
    // Default: lifecycleService.runLifecycleScan returns empty result
    mockLifecycleService.runLifecycleScan.mockResolvedValue({ staleCount: 0, archivedCount: 0 });
  });

  describe('calculateConfidence', () => {
    it('should compute confidence using the formula 0.4*min(n/10,1) + 0.3*min(d/14,1) + 0.3*s', () => {
      const result = engine.calculateConfidence({
        fragmentCount: 5,
        timeSpanDays: 7,
        avgSimilarity: 0.8,
      });
      // 0.4 * min(5/10, 1) + 0.3 * min(7/14, 1) + 0.3 * 0.8
      // = 0.4 * 0.5 + 0.3 * 0.5 + 0.3 * 0.8
      // = 0.2 + 0.15 + 0.24 = 0.59
      expect(result).toBeCloseTo(0.59, 5);
    });

    it('should cap fragmentCount at 10 and timeSpanDays at 14', () => {
      const result = engine.calculateConfidence({
        fragmentCount: 20,
        timeSpanDays: 30,
        avgSimilarity: 1.0,
      });
      // 0.4 * 1 + 0.3 * 1 + 0.3 * 1 = 1.0
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should return 0 when all inputs are 0', () => {
      const result = engine.calculateConfidence({
        fragmentCount: 0,
        timeSpanDays: 0,
        avgSimilarity: 0,
      });
      expect(result).toBe(0);
    });

    it('should clamp avgSimilarity to [0, 1]', () => {
      const result = engine.calculateConfidence({
        fragmentCount: 10,
        timeSpanDays: 14,
        avgSimilarity: 1.5,
      });
      // s is clamped to 1.0
      // 0.4 * 1 + 0.3 * 1 + 0.3 * 1 = 1.0
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should handle negative inputs by clamping to 0', () => {
      const result = engine.calculateConfidence({
        fragmentCount: -5,
        timeSpanDays: -3,
        avgSimilarity: -0.5,
      });
      expect(result).toBe(0);
    });

    it('should always return a value in [0, 1]', () => {
      const result = engine.calculateConfidence({
        fragmentCount: 100,
        timeSpanDays: 100,
        avgSimilarity: 1.0,
      });
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('updateGrowthPhase', () => {
    it('should set phase to discovery when confidence < 0.6', async () => {
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await engine.updateGrowthPhase('body-1', 0.3);

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-1' },
        data: { confidenceScore: 0.3, growthPhase: 'discovery' },
      });
    });

    it('should set phase to skeleton when confidence >= 0.6 and < 0.8', async () => {
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await engine.updateGrowthPhase('body-1', 0.7);

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-1' },
        data: { confidenceScore: 0.7, growthPhase: 'skeleton' },
      });
    });

    it('should set phase to flesh when confidence >= 0.8', async () => {
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await engine.updateGrowthPhase('body-1', 0.9);

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-1' },
        data: { confidenceScore: 0.9, growthPhase: 'flesh' },
      });
    });

    it('should set phase to skeleton at exactly 0.6', async () => {
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await engine.updateGrowthPhase('body-1', 0.6);

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-1' },
        data: { confidenceScore: 0.6, growthPhase: 'skeleton' },
      });
    });

    it('should set phase to flesh at exactly 0.8', async () => {
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await engine.updateGrowthPhase('body-1', 0.8);

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-1' },
        data: { confidenceScore: 0.8, growthPhase: 'flesh' },
      });
    });
  });

  describe('discover', () => {
    it('should reject when already running (Req 8.1)', async () => {
      engine._isRunning = true;

      const result = await engine.discover('manual');

      expect(result.status).toBe('rejected');
      expect(result.reason).toContain('already running');
      expect(result.triggeredBy).toBe('manual');
      expect(mockPrisma.themeDiscoveryLog.create).not.toHaveBeenCalled();
    });

    it('should return skipped when no users with fragments exist', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-skip' });

      const result = await engine.discover('scheduler');

      expect(result.status).toBe('skipped');
      expect(result.triggeredBy).toBe('scheduler');
      expect(result.logId).toBe('log-skip');
      expect(engine._isRunning).toBe(false);
    });

    it('should return skipped when no new fragments since last discovery (Req 5.2, 5.3, 7.4)', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({ userId: 'user-1' });
      // _hasNewFragments returns false
      mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue({
        id: 'log-prev',
        status: 'completed',
        completedAt: new Date('2024-06-01'),
      });
      mockPrisma.cognitiveFragment.count.mockResolvedValue(0);
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-skip' });

      const result = await engine.discover('manual');

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('No new fragments');
      expect(result.triggeredBy).toBe('manual');
      expect(mockPrisma.themeDiscoveryLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'skipped',
          triggeredBy: 'manual',
        }),
      });
      expect(engine._isRunning).toBe(false);
    });

    it('should execute full three-stage pipeline when new fragments exist (Req 5.4)', async () => {
      // Setup: user exists, has new fragments
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({ userId: 'user-1' });
      // _hasNewFragments returns true (first run)
      mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue(null);
      // Create running log
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-1' });
      // Fetch fragments (30-day window)
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', content: '学习摄影构图', createdAt: new Date() },
        { id: 'f2', content: '摄影光线技巧', createdAt: new Date() },
      ]);
      // Stage 1: extractKeywords - LLM returns keywords
      llmClient.callJSON
        .mockResolvedValueOnce({ keywords: ['摄影', '构图'] })
        .mockResolvedValueOnce({ keywords: ['摄影', '光线'] })
        // Stage 3: analyzeThemes - LLM returns theme candidates
        .mockResolvedValueOnce({
          themes: [
            { themeName: '摄影技巧', themeDescription: '关于摄影的知识', fragmentIds: ['f1', 'f2'] },
          ],
        });
      // _matchExistingBody: no existing bodies
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);
      // _createBody mocks
      embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeBody.create.mockResolvedValue({ id: 'body-new' });
      // Update log
      mockPrisma.themeDiscoveryLog.update.mockResolvedValue({});

      const result = await engine.discover('manual');

      expect(result.status).toBe('completed');
      expect(result.themesFound).toBe(1);
      expect(result.fragmentsScanned).toBe(2);
      expect(result.triggeredBy).toBe('manual');
      expect(result.logId).toBe('log-1');
      expect(engine._isRunning).toBe(false);
    });

    it('should create running log with triggeredBy field (Req 7.1, 7.5)', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue(null);
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
      mockPrisma.themeDiscoveryLog.update.mockResolvedValue({});

      await engine.discover('scheduler');

      // The running log should be the second create call (first is for skipped check)
      // Actually with empty fragments, filterHighFrequency will skip
      expect(mockPrisma.themeDiscoveryLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'running',
          triggeredBy: 'scheduler',
        }),
      });
    });

    it('should return completed with themesFound=0 when no high-frequency keywords (Req 2.3)', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue(null);
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-1' });
      // Fragments with no repeated keywords
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', content: '摄影构图', createdAt: new Date() },
        { id: 'f2', content: '编程入门', createdAt: new Date() },
      ]);
      llmClient.callJSON
        .mockResolvedValueOnce({ keywords: ['摄影'] })
        .mockResolvedValueOnce({ keywords: ['编程'] });
      mockPrisma.themeDiscoveryLog.update.mockResolvedValue({});

      const result = await engine.discover('manual');

      expect(result.status).toBe('completed');
      expect(result.themesFound).toBe(0);
      expect(result.fragmentsScanned).toBe(2);
      expect(mockPrisma.themeDiscoveryLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: expect.objectContaining({
          status: 'completed',
          themesFound: 0,
        }),
      });
    });

    it('should reset _isRunning flag after completion (Req 8.3)', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue(null);
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
      mockPrisma.themeDiscoveryLog.update.mockResolvedValue({});

      await engine.discover('scheduler');

      expect(engine._isRunning).toBe(false);
    });

    it('should reset _isRunning flag on error and return failed status (Req 7.3, 8.3)', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue(null);
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.cognitiveFragment.findMany.mockRejectedValue(new Error('DB error'));
      mockPrisma.themeDiscoveryLog.update.mockResolvedValue({});

      const result = await engine.discover('manual');

      expect(result.status).toBe('failed');
      expect(result.reason).toBe('DB error');
      expect(engine._isRunning).toBe(false);
      expect(mockPrisma.themeDiscoveryLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: expect.objectContaining({
          status: 'failed',
          error: 'DB error',
        }),
      });
    });

    it('should update existing body and detect evolution when match found (Req 4.1, 4.2, 6.1)', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue(null);
      mockPrisma.themeDiscoveryLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', content: '摄影构图', createdAt: new Date() },
        { id: 'f2', content: '摄影光线', createdAt: new Date() },
      ]);
      llmClient.callJSON
        .mockResolvedValueOnce({ keywords: ['摄影', '构图'] })
        .mockResolvedValueOnce({ keywords: ['摄影', '光线'] })
        .mockResolvedValueOnce({
          themes: [
            { themeName: '摄影技巧', themeDescription: '关于摄影的知识', fragmentIds: ['f1', 'f2'] },
          ],
        });

      // _matchExistingBody: existing body found
      const existingBody = {
        id: 'body-1',
        userId: 'user-1',
        themeName: '摄影构图',
        themeDescription: '摄影构图技巧',
        relatedFragmentIds: JSON.stringify(['f1']),
        relatedEntityIds: JSON.stringify([]),
      };
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);
      embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      embeddingService.cosineSimilarity.mockReturnValue(0.9);

      // intentAggregationService.assignFragment returns matched body
      mockIntentAggregationService.assignFragment.mockResolvedValue(existingBody);
      // intentAggregationService.aggregateBodies returns empty result
      mockIntentAggregationService.aggregateBodies.mockResolvedValue({ intentBodiesCreated: 0, bodiesMerged: 0, errors: [] });

      // _updateBody mocks
      mockPrisma.knowledgeBody.update.mockResolvedValue({});
      mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);

      // _detectEvolution mocks
      mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-1' });

      mockPrisma.themeDiscoveryLog.update.mockResolvedValue({});

      const result = await engine.discover('manual');

      expect(result.status).toBe('completed');
      // Existing body was updated, not created new, so themesFound = 0
      expect(result.themesFound).toBe(0);
    });

    it('should handle error before log creation gracefully', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockRejectedValue(new Error('Connection failed'));

      const result = await engine.discover('manual');

      expect(result.status).toBe('failed');
      expect(result.reason).toBe('Connection failed');
      expect(engine._isRunning).toBe(false);
    });
  });

  describe('_findRelatedEntities', () => {
    it('should return entity IDs whose cleanedName appears in fragment content', async () => {
      mockPrisma.unifiedEntity.findMany.mockResolvedValue([
        { id: 'e1', cleanedName: '摄影', description: '摄影技术' },
        { id: 'e2', cleanedName: '编程', description: '软件开发' },
        { id: 'e3', cleanedName: '烹饪', description: '美食制作' },
      ]);

      const fragmentContents = [
        '学习摄影构图技巧',
        '编程语言入门指南',
        '摄影后期处理',
      ];

      const result = await engine._findRelatedEntities(fragmentContents);

      expect(result).toContain('e1'); // 摄影 appears in fragments
      expect(result).toContain('e2'); // 编程 appears in fragments
      expect(result).not.toContain('e3'); // 烹饪 does not appear
    });

    it('should return empty array when no entities exist', async () => {
      mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);

      const result = await engine._findRelatedEntities(['some content']);
      expect(result).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      mockPrisma.unifiedEntity.findMany.mockRejectedValue(new Error('DB error'));

      const result = await engine._findRelatedEntities(['some content']);
      expect(result).toEqual([]);
    });

    it('should perform case-insensitive matching', async () => {
      mockPrisma.unifiedEntity.findMany.mockResolvedValue([
        { id: 'e1', cleanedName: 'React', description: 'UI library' },
      ]);

      const result = await engine._findRelatedEntities(['Learning react hooks']);
      expect(result).toContain('e1');
    });

    it('should skip entities with empty cleanedName', async () => {
      mockPrisma.unifiedEntity.findMany.mockResolvedValue([
        { id: 'e1', cleanedName: '', description: 'empty name' },
        { id: 'e2', cleanedName: '   ', description: 'whitespace name' },
      ]);

      const result = await engine._findRelatedEntities(['some content']);
      expect(result).toEqual([]);
    });
  });

  describe('exports', () => {
    it('should export singleton instance', () => {
      const instance = require('./themeDiscoveryEngine');
      expect(instance).toBeDefined();
      expect(typeof instance.discover).toBe('function');
    });

    it('should export ThemeDiscoveryEngine class', () => {
      expect(ThemeDiscoveryEngine).toBeDefined();
    });
  });
});

describe('ThemeDiscoveryEngine - extractKeywords & _extractKeywordsFromContent', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  describe('_extractKeywordsFromContent', () => {
    it('should call llmClient.callJSON with keyword extraction prompt', async () => {
      llmClient.callJSON.mockResolvedValue({ keywords: ['摄影', '构图'] });

      const result = await engine._extractKeywordsFromContent('学习摄影构图技巧');

      expect(llmClient.callJSON).toHaveBeenCalledWith(
        expect.stringContaining('提取关键词和实体'),
        expect.objectContaining({ temperature: 0.1 })
      );
      expect(result).toEqual(['摄影', '构图']);
    });

    it('should include synonym merging instruction in prompt', async () => {
      llmClient.callJSON.mockResolvedValue({ keywords: ['乌镇'] });

      await engine._extractKeywordsFromContent('游览乌镇古镇');

      const prompt = llmClient.callJSON.mock.calls[0][0];
      expect(prompt).toContain('归并');
    });

    it('should return empty array when LLM returns no keywords field', async () => {
      llmClient.callJSON.mockResolvedValue({});

      const result = await engine._extractKeywordsFromContent('some content');
      expect(result).toEqual([]);
    });

    it('should propagate LLM errors', async () => {
      llmClient.callJSON.mockRejectedValue(new Error('LLM timeout'));

      await expect(engine._extractKeywordsFromContent('content')).rejects.toThrow('LLM timeout');
    });

    it('should convert non-string keyword values to strings', async () => {
      llmClient.callJSON.mockResolvedValue({ keywords: [123, true, '正常'] });

      const result = await engine._extractKeywordsFromContent('content');
      expect(result).toEqual(['123', 'true', '正常']);
    });
  });

  describe('extractKeywords', () => {
    it('should build KeywordIndex from fragments with LLM-extracted keywords', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce({ keywords: ['摄影', '构图'] })
        .mockResolvedValueOnce({ keywords: ['摄影', '光线'] });

      const fragments = [
        { id: 'f1', content: '学习摄影构图' },
        { id: 'f2', content: '摄影光线技巧' },
      ];

      const result = await engine.extractKeywords(fragments);

      expect(result.totalFragments).toBe(2);
      expect(result.isFallback).toBe(false);
      expect(result.keywords.get('摄影')).toEqual({ count: 2, fragmentIds: ['f1', 'f2'] });
      expect(result.keywords.get('构图')).toEqual({ count: 1, fragmentIds: ['f1'] });
      expect(result.keywords.get('光线')).toEqual({ count: 1, fragmentIds: ['f2'] });
    });

    it('should normalize keywords to lowercase', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce({ keywords: ['React'] })
        .mockResolvedValueOnce({ keywords: ['react'] });

      const fragments = [
        { id: 'f1', content: 'React hooks' },
        { id: 'f2', content: 'react state' },
      ];

      const result = await engine.extractKeywords(fragments);

      expect(result.keywords.has('react')).toBe(true);
      expect(result.keywords.get('react').count).toBe(2);
    });

    it('should skip fragments where LLM fails and continue processing', async () => {
      llmClient.callJSON
        .mockRejectedValueOnce(new Error('LLM error'))
        .mockResolvedValueOnce({ keywords: ['编程'] });

      const fragments = [
        { id: 'f1', content: 'content 1' },
        { id: 'f2', content: 'content 2' },
      ];

      const result = await engine.extractKeywords(fragments);

      expect(result.totalFragments).toBe(2);
      expect(result.keywords.get('编程')).toEqual({ count: 1, fragmentIds: ['f2'] });
    });

    it('should not count the same fragment twice for the same keyword', async () => {
      llmClient.callJSON.mockResolvedValueOnce({ keywords: ['摄影', '摄影'] });

      const fragments = [{ id: 'f1', content: '摄影摄影' }];

      const result = await engine.extractKeywords(fragments);

      expect(result.keywords.get('摄影').count).toBe(1);
      expect(result.keywords.get('摄影').fragmentIds).toEqual(['f1']);
    });

    it('should handle empty fragments array', async () => {
      const result = await engine.extractKeywords([]);

      expect(result.totalFragments).toBe(0);
      expect(result.isFallback).toBe(false);
      expect(result.keywords.size).toBe(0);
    });

    it('should skip empty/whitespace keywords', async () => {
      llmClient.callJSON.mockResolvedValueOnce({ keywords: ['', '  ', '有效'] });

      const fragments = [{ id: 'f1', content: 'content' }];

      const result = await engine.extractKeywords(fragments);

      expect(result.keywords.has('')).toBe(false);
      expect(result.keywords.has('有效')).toBe(true);
    });

    it('should handle fragments with null/undefined content', async () => {
      llmClient.callJSON.mockResolvedValueOnce({ keywords: ['关键词'] });

      const fragments = [{ id: 'f1', content: null }];

      const result = await engine.extractKeywords(fragments);

      // Should call LLM with empty string for null content
      expect(llmClient.callJSON).toHaveBeenCalledWith(
        expect.stringContaining(''),
        expect.any(Object)
      );
    });
  });
});



describe('ThemeDiscoveryEngine - _fallbackTokenize', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should return KeywordIndex with isFallback=true', () => {
    const fragments = [
      { id: 'f1', content: '学习摄影构图技巧' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.isFallback).toBe(true);
  });

  it('should set totalFragments to the number of input fragments', () => {
    const fragments = [
      { id: 'f1', content: '摄影技巧' },
      { id: 'f2', content: '编程入门' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.totalFragments).toBe(2);
  });

  it('should split content by punctuation and spaces into tokens', () => {
    const fragments = [
      { id: 'f1', content: '摄影,构图。光线！色彩' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.keywords.has('摄影')).toBe(true);
    expect(result.keywords.has('构图')).toBe(true);
    expect(result.keywords.has('光线')).toBe(true);
    expect(result.keywords.has('色彩')).toBe(true);
  });

  it('should filter out stop words', () => {
    const fragments = [
      { id: 'f1', content: '这 是 一个 摄影 的 技巧' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.keywords.has('摄影')).toBe(true);
    expect(result.keywords.has('技巧')).toBe(true);
    expect(result.keywords.has('的')).toBe(false);
    expect(result.keywords.has('是')).toBe(false);
    expect(result.keywords.has('这')).toBe(false);
    expect(result.keywords.has('一个')).toBe(false);
  });

  it('should count keywords across multiple fragments correctly', () => {
    const fragments = [
      { id: 'f1', content: '摄影 构图' },
      { id: 'f2', content: '摄影 光线' },
      { id: 'f3', content: '摄影 色彩' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.keywords.get('摄影')).toEqual({ count: 3, fragmentIds: ['f1', 'f2', 'f3'] });
    expect(result.keywords.get('构图')).toEqual({ count: 1, fragmentIds: ['f1'] });
  });

  it('should not count the same token twice for the same fragment', () => {
    const fragments = [
      { id: 'f1', content: '摄影 摄影 摄影' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.keywords.get('摄影').count).toBe(1);
    expect(result.keywords.get('摄影').fragmentIds).toEqual(['f1']);
  });

  it('should handle empty fragments array', () => {
    const result = engine._fallbackTokenize([]);

    expect(result.totalFragments).toBe(0);
    expect(result.isFallback).toBe(true);
    expect(result.keywords.size).toBe(0);
  });

  it('should skip fragments with empty or whitespace-only content', () => {
    const fragments = [
      { id: 'f1', content: '' },
      { id: 'f2', content: '   ' },
      { id: 'f3', content: '摄影' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.totalFragments).toBe(3);
    expect(result.keywords.size).toBe(1);
    expect(result.keywords.has('摄影')).toBe(true);
  });

  it('should handle fragments with null content', () => {
    const fragments = [
      { id: 'f1', content: null },
      { id: 'f2', content: '编程' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.totalFragments).toBe(2);
    expect(result.keywords.has('编程')).toBe(true);
  });

  it('should normalize tokens to lowercase', () => {
    const fragments = [
      { id: 'f1', content: 'React Hooks' },
      { id: 'f2', content: 'react state' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.keywords.has('react')).toBe(true);
    expect(result.keywords.get('react').count).toBe(2);
  });

  it('should filter English stop words', () => {
    const fragments = [
      { id: 'f1', content: 'the quick brown fox is very fast' },
    ];

    const result = engine._fallbackTokenize(fragments);

    expect(result.keywords.has('the')).toBe(false);
    expect(result.keywords.has('is')).toBe(false);
    expect(result.keywords.has('very')).toBe(false);
    expect(result.keywords.has('quick')).toBe(true);
    expect(result.keywords.has('brown')).toBe(true);
    expect(result.keywords.has('fox')).toBe(true);
    expect(result.keywords.has('fast')).toBe(true);
  });
});

describe('ThemeDiscoveryEngine - filterHighFrequency', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should filter keywords with count >= threshold and sort by count descending', () => {
    const keywordIndex = {
      keywords: new Map([
        ['摄影', { count: 3, fragmentIds: ['f1', 'f2', 'f3'] }],
        ['编程', { count: 2, fragmentIds: ['f1', 'f2'] }],
        ['烹饪', { count: 1, fragmentIds: ['f3'] }],
      ]),
      totalFragments: 3,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex, 2);

    expect(result.skipped).toBe(false);
    expect(result.highFreqKeywords).toHaveLength(2);
    expect(result.highFreqKeywords[0]).toEqual({ keyword: '摄影', count: 3, fragmentIds: ['f1', 'f2', 'f3'] });
    expect(result.highFreqKeywords[1]).toEqual({ keyword: '编程', count: 2, fragmentIds: ['f1', 'f2'] });
  });

  it('should return skipped=true when no keyword meets the threshold', () => {
    const keywordIndex = {
      keywords: new Map([
        ['摄影', { count: 1, fragmentIds: ['f1'] }],
        ['编程', { count: 1, fragmentIds: ['f2'] }],
      ]),
      totalFragments: 2,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex, 2);

    expect(result.skipped).toBe(true);
    expect(result.highFreqKeywords).toHaveLength(0);
  });

  it('should use default threshold of 2', () => {
    const keywordIndex = {
      keywords: new Map([
        ['摄影', { count: 2, fragmentIds: ['f1', 'f2'] }],
        ['编程', { count: 1, fragmentIds: ['f1'] }],
      ]),
      totalFragments: 2,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex);

    expect(result.highFreqKeywords).toHaveLength(1);
    expect(result.highFreqKeywords[0].keyword).toBe('摄影');
  });

  it('should handle empty keyword index', () => {
    const keywordIndex = {
      keywords: new Map(),
      totalFragments: 0,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex, 2);

    expect(result.skipped).toBe(true);
    expect(result.highFreqKeywords).toHaveLength(0);
  });

  it('should preserve fragmentIds for each high-frequency keyword', () => {
    const keywordIndex = {
      keywords: new Map([
        ['旅行', { count: 3, fragmentIds: ['f1', 'f3', 'f5'] }],
      ]),
      totalFragments: 5,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex, 2);

    expect(result.highFreqKeywords[0].fragmentIds).toEqual(['f1', 'f3', 'f5']);
  });

  it('should not mutate the original keywordIndex fragmentIds', () => {
    const originalFragmentIds = ['f1', 'f2'];
    const keywordIndex = {
      keywords: new Map([
        ['摄影', { count: 2, fragmentIds: originalFragmentIds }],
      ]),
      totalFragments: 2,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex, 2);

    // Mutate the result's fragmentIds
    result.highFreqKeywords[0].fragmentIds.push('f99');

    // Original should be unchanged
    expect(originalFragmentIds).toEqual(['f1', 'f2']);
  });

  it('should include keywords with count exactly equal to threshold', () => {
    const keywordIndex = {
      keywords: new Map([
        ['摄影', { count: 5, fragmentIds: ['f1', 'f2', 'f3', 'f4', 'f5'] }],
        ['编程', { count: 5, fragmentIds: ['f1', 'f2', 'f3', 'f4', 'f5'] }],
      ]),
      totalFragments: 5,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex, 5);

    expect(result.highFreqKeywords).toHaveLength(2);
  });

  it('should work with custom threshold', () => {
    const keywordIndex = {
      keywords: new Map([
        ['摄影', { count: 5, fragmentIds: ['f1', 'f2', 'f3', 'f4', 'f5'] }],
        ['编程', { count: 3, fragmentIds: ['f1', 'f2', 'f3'] }],
        ['烹饪', { count: 2, fragmentIds: ['f1', 'f2'] }],
      ]),
      totalFragments: 5,
      isFallback: false,
    };

    const result = engine.filterHighFrequency(keywordIndex, 3);

    expect(result.highFreqKeywords).toHaveLength(2);
    expect(result.highFreqKeywords[0].keyword).toBe('摄影');
    expect(result.highFreqKeywords[1].keyword).toBe('编程');
  });
});

describe('ThemeDiscoveryEngine - extractKeywords fallback behavior', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should fall back to _fallbackTokenize when all LLM calls fail', async () => {
    llmClient.callJSON
      .mockRejectedValueOnce(new Error('LLM error'))
      .mockRejectedValueOnce(new Error('LLM error'));

    const fragments = [
      { id: 'f1', content: '摄影 构图' },
      { id: 'f2', content: '摄影 光线' },
    ];

    const result = await engine.extractKeywords(fragments);

    expect(result.isFallback).toBe(true);
    expect(result.totalFragments).toBe(2);
    expect(result.keywords.has('摄影')).toBe(true);
    expect(result.keywords.get('摄影').count).toBe(2);
  });

  it('should NOT fall back when at least one LLM call succeeds', async () => {
    llmClient.callJSON
      .mockRejectedValueOnce(new Error('LLM error'))
      .mockResolvedValueOnce({ keywords: ['编程'] });

    const fragments = [
      { id: 'f1', content: 'content 1' },
      { id: 'f2', content: 'content 2' },
    ];

    const result = await engine.extractKeywords(fragments);

    expect(result.isFallback).toBe(false);
    expect(result.keywords.has('编程')).toBe(true);
  });

  it('should NOT fall back when LLM returns empty keywords for all fragments', async () => {
    llmClient.callJSON
      .mockResolvedValueOnce({ keywords: [] })
      .mockResolvedValueOnce({ keywords: [] });

    const fragments = [
      { id: 'f1', content: 'content 1' },
      { id: 'f2', content: 'content 2' },
    ];

    const result = await engine.extractKeywords(fragments);

    // LLM calls succeeded but returned no keywords - this is not a failure
    expect(result.isFallback).toBe(false);
    expect(result.keywords.size).toBe(0);
  });

  it('should NOT fall back for empty fragments array', async () => {
    const result = await engine.extractKeywords([]);

    expect(result.isFallback).toBe(false);
    expect(result.keywords.size).toBe(0);
  });
});

describe('ThemeDiscoveryEngine - analyzeThemes', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should call llmClient.callJSON with assembled prompt and return ThemeCandidates', async () => {
    llmClient.callJSON.mockResolvedValue({
      themes: [
        { themeName: '摄影技巧', themeDescription: '关于摄影构图和光线的知识', fragmentIds: ['f1', 'f2'] },
      ],
    });

    const highFreqKeywords = [
      { keyword: '摄影', count: 2, fragmentIds: ['f1', 'f2'] },
    ];
    const fragmentMap = new Map([
      ['f1', { id: 'f1', content: '学习摄影构图' }],
      ['f2', { id: 'f2', content: '摄影光线技巧' }],
    ]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(llmClient.callJSON).toHaveBeenCalledWith(
      expect.stringContaining('摄影'),
      expect.objectContaining({ temperature: 0.3 })
    );
    expect(result).toHaveLength(1);
    expect(result[0].themeName).toBe('摄影技巧');
    expect(result[0].themeDescription).toBe('关于摄影构图和光线的知识');
    expect(result[0].fragmentIds).toEqual(['f1', 'f2']);
  });

  it('should include geographic split instruction in prompt', async () => {
    llmClient.callJSON.mockResolvedValue({ themes: [] });

    const highFreqKeywords = [
      { keyword: '旅行', count: 2, fragmentIds: ['f1', 'f2'] },
    ];
    const fragmentMap = new Map([
      ['f1', { id: 'f1', content: '北京旅行' }],
      ['f2', { id: 'f2', content: '上海旅行' }],
    ]);

    await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    const prompt = llmClient.callJSON.mock.calls[0][0];
    expect(prompt).toContain('地理位置不同');
    expect(prompt).toContain('拆分为独立主题');
  });

  it('should truncate themeName to 20 characters', async () => {
    llmClient.callJSON.mockResolvedValue({
      themes: [
        { themeName: '这是一个非常非常非常非常非常长的主题名称超过二十个字符', themeDescription: '描述', fragmentIds: ['f1'] },
      ],
    });

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1'] }];
    const fragmentMap = new Map([['f1', { id: 'f1', content: 'content' }]]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(result[0].themeName.length).toBeLessThanOrEqual(20);
  });

  it('should truncate themeDescription to 50 characters', async () => {
    llmClient.callJSON.mockResolvedValue({
      themes: [
        { themeName: '主题', themeDescription: '这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的描述超过五十个字符的限制', fragmentIds: ['f1'] },
      ],
    });

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1'] }];
    const fragmentMap = new Map([['f1', { id: 'f1', content: 'content' }]]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(result[0].themeDescription.length).toBeLessThanOrEqual(50);
  });

  it('should filter out invalid fragmentIds not in fragmentMap', async () => {
    llmClient.callJSON.mockResolvedValue({
      themes: [
        { themeName: '主题', themeDescription: '描述', fragmentIds: ['f1', 'f-invalid', 'f2', 'f-nonexistent'] },
      ],
    });

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1', 'f2'] }];
    const fragmentMap = new Map([
      ['f1', { id: 'f1', content: 'content 1' }],
      ['f2', { id: 'f2', content: 'content 2' }],
    ]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(result[0].fragmentIds).toEqual(['f1', 'f2']);
    expect(result[0].fragmentIds).not.toContain('f-invalid');
    expect(result[0].fragmentIds).not.toContain('f-nonexistent');
  });

  it('should throw error when LLM call fails (caller handles logging)', async () => {
    llmClient.callJSON.mockRejectedValue(new Error('LLM service unavailable'));

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1'] }];
    const fragmentMap = new Map([['f1', { id: 'f1', content: 'content' }]]);

    await expect(engine.analyzeThemes(highFreqKeywords, fragmentMap)).rejects.toThrow('LLM service unavailable');
  });

  it('should handle LLM returning empty themes array', async () => {
    llmClient.callJSON.mockResolvedValue({ themes: [] });

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1'] }];
    const fragmentMap = new Map([['f1', { id: 'f1', content: 'content' }]]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(result).toEqual([]);
  });

  it('should handle LLM returning no themes field', async () => {
    llmClient.callJSON.mockResolvedValue({});

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1'] }];
    const fragmentMap = new Map([['f1', { id: 'f1', content: 'content' }]]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(result).toEqual([]);
  });

  it('should handle multiple themes from LLM response', async () => {
    llmClient.callJSON.mockResolvedValue({
      themes: [
        { themeName: '北京旅行', themeDescription: '北京景点游览', fragmentIds: ['f1'] },
        { themeName: '上海旅行', themeDescription: '上海美食探索', fragmentIds: ['f2'] },
      ],
    });

    const highFreqKeywords = [
      { keyword: '旅行', count: 2, fragmentIds: ['f1', 'f2'] },
    ];
    const fragmentMap = new Map([
      ['f1', { id: 'f1', content: '北京故宫游览' }],
      ['f2', { id: 'f2', content: '上海外滩美食' }],
    ]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(result).toHaveLength(2);
    expect(result[0].themeName).toBe('北京旅行');
    expect(result[1].themeName).toBe('上海旅行');
  });

  it('should handle null/undefined values in theme objects gracefully', async () => {
    llmClient.callJSON.mockResolvedValue({
      themes: [
        { themeName: null, themeDescription: undefined, fragmentIds: ['f1'] },
      ],
    });

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1'] }];
    const fragmentMap = new Map([['f1', { id: 'f1', content: 'content' }]]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    expect(result[0].themeName).toBe('');
    expect(result[0].themeDescription).toBe('');
    expect(result[0].fragmentIds).toEqual(['f1']);
  });

  it('should convert non-string fragmentIds to strings before validation', async () => {
    llmClient.callJSON.mockResolvedValue({
      themes: [
        { themeName: '主题', themeDescription: '描述', fragmentIds: [123, 'f1'] },
      ],
    });

    const highFreqKeywords = [{ keyword: 'kw', count: 2, fragmentIds: ['f1'] }];
    const fragmentMap = new Map([
      ['f1', { id: 'f1', content: 'content' }],
    ]);

    const result = await engine.analyzeThemes(highFreqKeywords, fragmentMap);

    // '123' is not in fragmentMap, so it should be filtered out
    expect(result[0].fragmentIds).toEqual(['f1']);
  });
});



describe('ThemeDiscoveryEngine - _matchExistingBody', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should return null when user has no existing knowledge bodies', async () => {
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1', 'f2'],
    });

    expect(result).toBeNull();
  });

  it('should match body with high name similarity and fragment overlap', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: JSON.stringify(['f1', 'f2']),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    // High name similarity
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])  // candidate embedding
      .mockResolvedValueOnce([0.1, 0.2]); // body embedding
    embeddingService.cosineSimilarity.mockReturnValue(0.9);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1', 'f3'],
    });

    expect(result).toBe(existingBody);
  });

  it('should return null when score is below threshold', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '编程入门',
      relatedFragmentIds: JSON.stringify(['f10', 'f11']),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    // Low name similarity
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.9, 0.1]);
    embeddingService.cosineSimilarity.mockReturnValue(0.1);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1', 'f2'], // no overlap with body
    });

    // score = 0.6 * 0.1 + 0.4 * 0 = 0.06, below 0.4 threshold
    expect(result).toBeNull();
  });

  it('should return the body with the highest score when multiple bodies exist', async () => {
    const body1 = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '编程入门',
      relatedFragmentIds: JSON.stringify(['f10']),
    };
    const body2 = {
      id: 'body-2',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: JSON.stringify(['f1', 'f2']),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([body1, body2]);

    // First body: low similarity
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])  // candidate for body1
      .mockResolvedValueOnce([0.9, 0.1])  // body1
      .mockResolvedValueOnce([0.1, 0.2])  // candidate for body2
      .mockResolvedValueOnce([0.1, 0.2]); // body2
    embeddingService.cosineSimilarity
      .mockReturnValueOnce(0.2)  // body1 name similarity
      .mockReturnValueOnce(0.9); // body2 name similarity

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1', 'f3'],
    });

    expect(result).toBe(body2);
  });

  it('should match based on fragment overlap even when embedding fails', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: JSON.stringify(['f1', 'f2', 'f3']),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    // Embedding fails
    embeddingService.generateEmbedding.mockResolvedValue(null);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1', 'f2', 'f4'],
    });

    // nameSimilarity = 0 (embedding failed)
    // overlap: intersection = {f1, f2}, union = {f1, f2, f3, f4} => 2/4 = 0.5
    // score = 0.6 * 0 + 0.4 * 0.5 = 0.2, below 0.4 threshold
    expect(result).toBeNull();
  });

  it('should match when fragment overlap alone exceeds threshold', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: JSON.stringify(['f1', 'f2']),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    // Embedding fails
    embeddingService.generateEmbedding.mockResolvedValue(null);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1', 'f2'], // 100% overlap
    });

    // nameSimilarity = 0, overlap = 2/2 = 1.0
    // score = 0.6 * 0 + 0.4 * 1.0 = 0.4, exactly at threshold
    expect(result).toBe(existingBody);
  });

  it('should handle body with empty relatedFragmentIds', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: JSON.stringify([]),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.1, 0.2]);
    embeddingService.cosineSimilarity.mockReturnValue(0.8);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1'],
    });

    // nameSimilarity = 0.8, overlap = 0/1 = 0
    // score = 0.6 * 0.8 + 0.4 * 0 = 0.48, above 0.4 threshold
    expect(result).toBe(existingBody);
  });

  it('should handle candidate with empty fragmentIds', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: JSON.stringify(['f1', 'f2']),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.1, 0.2]);
    embeddingService.cosineSimilarity.mockReturnValue(0.8);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: [],
    });

    // nameSimilarity = 0.8, overlap = 0/2 = 0
    // score = 0.6 * 0.8 + 0.4 * 0 = 0.48, above threshold
    expect(result).toBe(existingBody);
  });

  it('should handle body with null relatedFragmentIds', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: null,
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.1, 0.2]);
    embeddingService.cosineSimilarity.mockReturnValue(0.9);

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1'],
    });

    // nameSimilarity = 0.9, overlap = 0/1 = 0
    // score = 0.6 * 0.9 + 0.4 * 0 = 0.54, above threshold
    expect(result).toBe(existingBody);
  });

  it('should handle embedding service throwing errors gracefully', async () => {
    const existingBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '摄影构图',
      relatedFragmentIds: JSON.stringify(['f1', 'f2']),
    };
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([existingBody]);

    embeddingService.generateEmbedding.mockRejectedValue(new Error('Embedding service down'));

    const result = await engine._matchExistingBody('user-1', {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1', 'f2'], // 100% overlap
    });

    // nameSimilarity = 0 (error), overlap = 2/2 = 1.0
    // score = 0.6 * 0 + 0.4 * 1.0 = 0.4, at threshold
    expect(result).toBe(existingBody);
  });

  it('should query knowledge bodies for the correct userId', async () => {
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

    await engine._matchExistingBody('user-42', {
      themeName: '主题',
      themeDescription: '描述',
      fragmentIds: [],
    });

    expect(mockPrisma.knowledgeBody.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-42' },
    });
  });
});


describe('ThemeDiscoveryEngine - _updateBody', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should merge candidate fragmentIds into existing body relatedFragmentIds (set union, no duplicates)', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'content 1', createdAt: new Date('2024-01-01') },
      { id: 'f2', content: 'content 2', createdAt: new Date('2024-01-05') },
      { id: 'f3', content: 'content 3', createdAt: new Date('2024-01-10') },
    ]);
    mockPrisma.knowledgeBody.update.mockResolvedValue({});
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);

    const body = {
      id: 'body-1',
      relatedFragmentIds: JSON.stringify(['f1', 'f2']),
      relatedEntityIds: JSON.stringify([]),
    };

    const candidate = {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f2', 'f3'], // f2 overlaps
    };

    await engine._updateBody(body, candidate);

    // Verify the update call has merged IDs
    const updateCall = mockPrisma.knowledgeBody.update.mock.calls.find(
      c => c[0].data.relatedFragmentIds
    );
    const mergedIds = JSON.parse(updateCall[0].data.relatedFragmentIds);
    expect(mergedIds).toHaveLength(3);
    expect(mergedIds).toContain('f1');
    expect(mergedIds).toContain('f2');
    expect(mergedIds).toContain('f3');
  });

  it('should recalculate confidenceScore and call updateGrowthPhase', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'content 1', createdAt: new Date('2024-01-01') },
      { id: 'f2', content: 'content 2', createdAt: new Date('2024-01-15') },
    ]);
    mockPrisma.knowledgeBody.update.mockResolvedValue({});
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);

    const body = {
      id: 'body-1',
      relatedFragmentIds: JSON.stringify(['f1']),
      relatedEntityIds: JSON.stringify([]),
    };

    const candidate = {
      themeName: '编程',
      themeDescription: '编程学习',
      fragmentIds: ['f2'],
    };

    await engine._updateBody(body, candidate);

    // updateGrowthPhase should have been called (it calls prisma.knowledgeBody.update)
    expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'body-1' },
        data: expect.objectContaining({
          confidenceScore: expect.any(Number),
          growthPhase: expect.any(String),
        }),
      })
    );
  });

  it('should query UnifiedEntity table and merge relatedEntityIds', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'learning react hooks', createdAt: new Date('2024-01-01') },
      { id: 'f2', content: 'react state management', createdAt: new Date('2024-01-05') },
    ]);
    mockPrisma.knowledgeBody.update.mockResolvedValue({});
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([
      { id: 'e1', cleanedName: 'react', description: 'UI library' },
      { id: 'e2', cleanedName: 'vue', description: 'UI framework' },
    ]);

    const body = {
      id: 'body-1',
      relatedFragmentIds: JSON.stringify(['f1']),
      relatedEntityIds: JSON.stringify(['e-old']),
    };

    const candidate = {
      themeName: 'React',
      themeDescription: 'React development',
      fragmentIds: ['f2'],
    };

    await engine._updateBody(body, candidate);

    // Verify entity IDs are merged
    const updateCall = mockPrisma.knowledgeBody.update.mock.calls.find(
      c => c[0].data.relatedEntityIds
    );
    const entityIds = JSON.parse(updateCall[0].data.relatedEntityIds);
    expect(entityIds).toContain('e-old');
    expect(entityIds).toContain('e1'); // react matches fragment content
    expect(entityIds).not.toContain('e2'); // vue doesn't match
  });

  it('should handle body with null relatedEntityIds', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'content', createdAt: new Date('2024-01-01') },
    ]);
    mockPrisma.knowledgeBody.update.mockResolvedValue({});
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);

    const body = {
      id: 'body-1',
      relatedFragmentIds: JSON.stringify([]),
      relatedEntityIds: null,
    };

    const candidate = {
      themeName: '主题',
      themeDescription: '描述',
      fragmentIds: ['f1'],
    };

    await engine._updateBody(body, candidate);

    const updateCall = mockPrisma.knowledgeBody.update.mock.calls.find(
      c => c[0].data.relatedEntityIds
    );
    const entityIds = JSON.parse(updateCall[0].data.relatedEntityIds);
    expect(Array.isArray(entityIds)).toBe(true);
  });

  it('should deduplicate entity IDs when merging', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'react hooks', createdAt: new Date('2024-01-01') },
    ]);
    mockPrisma.knowledgeBody.update.mockResolvedValue({});
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([
      { id: 'e1', cleanedName: 'react', description: 'UI library' },
    ]);

    const body = {
      id: 'body-1',
      relatedFragmentIds: JSON.stringify([]),
      relatedEntityIds: JSON.stringify(['e1']), // e1 already exists
    };

    const candidate = {
      themeName: 'React',
      themeDescription: 'React dev',
      fragmentIds: ['f1'],
    };

    await engine._updateBody(body, candidate);

    const updateCall = mockPrisma.knowledgeBody.update.mock.calls.find(
      c => c[0].data.relatedEntityIds
    );
    const entityIds = JSON.parse(updateCall[0].data.relatedEntityIds);
    expect(entityIds.filter(id => id === 'e1')).toHaveLength(1);
  });

  it('should handle empty candidate fragmentIds', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'content', createdAt: new Date('2024-01-01') },
    ]);
    mockPrisma.knowledgeBody.update.mockResolvedValue({});
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);

    const body = {
      id: 'body-1',
      relatedFragmentIds: JSON.stringify(['f1']),
      relatedEntityIds: JSON.stringify([]),
    };

    const candidate = {
      themeName: '主题',
      themeDescription: '描述',
      fragmentIds: [],
    };

    await engine._updateBody(body, candidate);

    const updateCall = mockPrisma.knowledgeBody.update.mock.calls.find(
      c => c[0].data.relatedFragmentIds
    );
    const mergedIds = JSON.parse(updateCall[0].data.relatedFragmentIds);
    expect(mergedIds).toEqual(['f1']);
  });

  it('should compute timeSpanDays as 0 when only one fragment exists', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'content', createdAt: new Date('2024-01-01') },
    ]);
    mockPrisma.knowledgeBody.update.mockResolvedValue({});
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);

    const body = {
      id: 'body-1',
      relatedFragmentIds: JSON.stringify([]),
      relatedEntityIds: JSON.stringify([]),
    };

    const candidate = {
      themeName: '主题',
      themeDescription: '描述',
      fragmentIds: ['f1'],
    };

    await engine._updateBody(body, candidate);

    // With 1 fragment, timeSpanDays=0, fragmentCount=1, avgSimilarity=0.7
    // confidence = 0.4 * min(1/10, 1) + 0.3 * min(0/14, 1) + 0.3 * 0.7
    //            = 0.4 * 0.1 + 0 + 0.21 = 0.25
    expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'body-1' },
        data: expect.objectContaining({
          growthPhase: 'discovery', // 0.25 < 0.6
        }),
      })
    );
  });
});

describe('ThemeDiscoveryEngine - _createBody', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should create a new KnowledgeBody with confidenceScore=0.3 and growthPhase="discovery"', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: '摄影构图技巧' },
      { id: 'f2', content: '光线运用方法' },
    ]);
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeBody.create.mockResolvedValue({ id: 'body-new' });

    const candidate = {
      themeName: '摄影技巧',
      themeDescription: '关于摄影构图和光线的知识',
      fragmentIds: ['f1', 'f2'],
    };

    await engine._createBody('user-1', candidate);

    expect(mockPrisma.knowledgeBody.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        themeName: '摄影技巧',
        themeDescription: '关于摄影构图和光线的知识',
        confidenceScore: 0.3,
        growthPhase: 'discovery',
        relatedFragmentIds: JSON.stringify(['f1', 'f2']),
      }),
    });
  });

  it('should generate themeEmbedding via embeddingService.generateEmbedding', async () => {
    const mockEmbedding = [0.5, 0.6, 0.7];
    embeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeBody.create.mockResolvedValue({ id: 'body-new' });

    const candidate = {
      themeName: '编程学习',
      themeDescription: '编程入门知识',
      fragmentIds: [],
    };

    await engine._createBody('user-1', candidate);

    expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('编程学习');
    expect(mockPrisma.knowledgeBody.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        themeEmbedding: JSON.stringify(mockEmbedding),
      }),
    });
  });

  it('should query UnifiedEntity table and write relatedEntityIds', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      { id: 'f1', content: 'learning react hooks' },
      { id: 'f2', content: 'react state management' },
    ]);
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([
      { id: 'e1', cleanedName: 'react', description: 'UI library' },
      { id: 'e2', cleanedName: 'vue', description: 'UI framework' },
    ]);
    mockPrisma.knowledgeBody.create.mockResolvedValue({ id: 'body-new' });

    const candidate = {
      themeName: 'React',
      themeDescription: 'React development',
      fragmentIds: ['f1', 'f2'],
    };

    await engine._createBody('user-1', candidate);

    const createCall = mockPrisma.knowledgeBody.create.mock.calls[0][0];
    const entityIds = JSON.parse(createCall.data.relatedEntityIds);
    expect(entityIds).toContain('e1'); // react matches fragment content
    expect(entityIds).not.toContain('e2'); // vue doesn't match
  });

  it('should handle embedding generation failure gracefully (themeEmbedding not set)', async () => {
    embeddingService.generateEmbedding.mockRejectedValue(new Error('Embedding service down'));
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeBody.create.mockResolvedValue({ id: 'body-new' });

    const candidate = {
      themeName: '主题',
      themeDescription: '描述',
      fragmentIds: [],
    };

    await engine._createBody('user-1', candidate);

    const createCall = mockPrisma.knowledgeBody.create.mock.calls[0][0];
    expect(createCall.data.themeEmbedding).toBeUndefined();
    // Should still create the body with other fields
    expect(createCall.data.confidenceScore).toBe(0.3);
    expect(createCall.data.growthPhase).toBe('discovery');
  });

  it('should handle empty fragmentIds in candidate', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1]);
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeBody.create.mockResolvedValue({ id: 'body-new' });

    const candidate = {
      themeName: '空主题',
      themeDescription: '无碎片',
      fragmentIds: [],
    };

    await engine._createBody('user-1', candidate);

    const createCall = mockPrisma.knowledgeBody.create.mock.calls[0][0];
    expect(createCall.data.relatedFragmentIds).toBe(JSON.stringify([]));
    expect(createCall.data.relatedEntityIds).toBe(JSON.stringify([]));
    // Should not query cognitiveFragment when no fragmentIds
    expect(mockPrisma.cognitiveFragment.findMany).not.toHaveBeenCalled();
  });

  it('should return the created KnowledgeBody', async () => {
    const createdBody = { id: 'body-new', themeName: '测试' };
    embeddingService.generateEmbedding.mockResolvedValue([0.1]);
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeBody.create.mockResolvedValue(createdBody);

    const candidate = {
      themeName: '测试',
      themeDescription: '测试描述',
      fragmentIds: [],
    };

    const result = await engine._createBody('user-1', candidate);

    expect(result).toBe(createdBody);
  });

  it('should handle null embedding from embeddingService (themeEmbedding not set)', async () => {
    embeddingService.generateEmbedding.mockResolvedValue(null);
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
    mockPrisma.unifiedEntity.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeBody.create.mockResolvedValue({ id: 'body-new' });

    const candidate = {
      themeName: '主题',
      themeDescription: '描述',
      fragmentIds: [],
    };

    await engine._createBody('user-1', candidate);

    const createCall = mockPrisma.knowledgeBody.create.mock.calls[0][0];
    expect(createCall.data.themeEmbedding).toBeUndefined();
  });
});

describe('ThemeDiscoveryEngine - _detectEvolution', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should return false and not create log when neither themeName nor themeDescription changed', async () => {
    const body = {
      id: 'body-1',
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
    };

    const candidate = {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(false);
    expect(mockPrisma.themeEvolutionLog.create).not.toHaveBeenCalled();
    expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
  });

  it('should detect evolution when themeName changes and record log with driftScore', async () => {
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2, 0.3]) // old embedding
      .mockResolvedValueOnce([0.4, 0.5, 0.6]); // new embedding
    embeddingService.cosineSimilarity.mockReturnValue(0.7);
    mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-1' });

    const body = {
      id: 'body-1',
      themeName: '摄影构图',
      themeDescription: '关于摄影的知识',
    };

    const candidate = {
      themeName: '摄影技巧',
      themeDescription: '关于摄影的知识',
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(true);
    expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('摄影构图 关于摄影的知识');
    expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('摄影技巧 关于摄影的知识');
    expect(embeddingService.cosineSimilarity).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6]
    );
    expect(mockPrisma.themeEvolutionLog.create).toHaveBeenCalledWith({
      data: {
        bodyId: 'body-1',
        previousThemeName: '摄影构图',
        previousThemeDescription: '关于摄影的知识',
        newThemeName: '摄影技巧',
        newThemeDescription: '关于摄影的知识',
        driftScore: expect.closeTo(0.3, 5), // 1 - 0.7
      },
    });
  });

  it('should detect evolution when themeDescription changes', async () => {
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.3, 0.4]);
    embeddingService.cosineSimilarity.mockReturnValue(0.85);
    mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-2' });

    const body = {
      id: 'body-1',
      themeName: '摄影技巧',
      themeDescription: '关于摄影构图的知识',
    };

    const candidate = {
      themeName: '摄影技巧',
      themeDescription: '关于摄影光线和构图的知识',
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(true);
    expect(mockPrisma.themeEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bodyId: 'body-1',
        previousThemeDescription: '关于摄影构图的知识',
        newThemeDescription: '关于摄影光线和构图的知识',
        driftScore: expect.closeTo(0.15, 5), // 1 - 0.85
      }),
    });
  });

  it('should detect evolution when both themeName and themeDescription change', async () => {
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.8, 0.9]);
    embeddingService.cosineSimilarity.mockReturnValue(0.3);
    mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-3' });

    const body = {
      id: 'body-1',
      themeName: '旧主题',
      themeDescription: '旧描述',
    };

    const candidate = {
      themeName: '新主题',
      themeDescription: '新描述',
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(true);
    expect(mockPrisma.themeEvolutionLog.create).toHaveBeenCalledWith({
      data: {
        bodyId: 'body-1',
        previousThemeName: '旧主题',
        previousThemeDescription: '旧描述',
        newThemeName: '新主题',
        newThemeDescription: '新描述',
        driftScore: 0.7, // 1 - 0.3
      },
    });
  });

  it('should handle null themeName/themeDescription in body gracefully', async () => {
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.0, 0.0])
      .mockResolvedValueOnce([0.5, 0.5]);
    embeddingService.cosineSimilarity.mockReturnValue(0.5);
    mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-4' });

    const body = {
      id: 'body-1',
      themeName: null,
      themeDescription: null,
    };

    const candidate = {
      themeName: '新主题',
      themeDescription: '新描述',
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(true);
    expect(mockPrisma.themeEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousThemeName: '',
        previousThemeDescription: '',
        newThemeName: '新主题',
        newThemeDescription: '新描述',
      }),
    });
  });

  it('should record driftScore=0 when embedding generation fails', async () => {
    embeddingService.generateEmbedding.mockRejectedValue(new Error('Embedding service down'));
    mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-5' });

    const body = {
      id: 'body-1',
      themeName: '旧主题',
      themeDescription: '旧描述',
    };

    const candidate = {
      themeName: '新主题',
      themeDescription: '新描述',
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(true);
    expect(mockPrisma.themeEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        driftScore: 0,
      }),
    });
  });

  it('should record driftScore=0 when embeddings are null', async () => {
    embeddingService.generateEmbedding.mockResolvedValue(null);
    mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-6' });

    const body = {
      id: 'body-1',
      themeName: '旧主题',
      themeDescription: '旧描述',
    };

    const candidate = {
      themeName: '新主题',
      themeDescription: '新描述',
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(true);
    expect(mockPrisma.themeEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        driftScore: 0,
      }),
    });
  });

  it('should handle null candidate themeName/themeDescription', async () => {
    embeddingService.generateEmbedding
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce([0.3, 0.4]);
    embeddingService.cosineSimilarity.mockReturnValue(0.6);
    mockPrisma.themeEvolutionLog.create.mockResolvedValue({ id: 'evo-7' });

    const body = {
      id: 'body-1',
      themeName: '旧主题',
      themeDescription: '旧描述',
    };

    const candidate = {
      themeName: null,
      themeDescription: null,
      fragmentIds: ['f1'],
    };

    const result = await engine._detectEvolution(body, candidate);

    expect(result).toBe(true);
    expect(mockPrisma.themeEvolutionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousThemeName: '旧主题',
        newThemeName: '',
        previousThemeDescription: '旧描述',
        newThemeDescription: '',
        driftScore: 0.4, // 1 - 0.6
      }),
    });
  });
});

describe('ThemeDiscoveryEngine - _hasNewFragments', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ThemeDiscoveryEngine();
  });

  it('should return true when no previous successful discovery exists (first run)', async () => {
    mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue(null);

    const result = await engine._hasNewFragments('user-1');

    expect(result).toBe(true);
    expect(mockPrisma.themeDiscoveryLog.findFirst).toHaveBeenCalledWith({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });
    // Should not query cognitiveFragment.count when no previous log exists
    expect(mockPrisma.cognitiveFragment.count).not.toHaveBeenCalled();
  });

  it('should return true when last completed log has no completedAt', async () => {
    mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue({
      id: 'log-1',
      status: 'completed',
      completedAt: null,
    });

    const result = await engine._hasNewFragments('user-1');

    expect(result).toBe(true);
    expect(mockPrisma.cognitiveFragment.count).not.toHaveBeenCalled();
  });

  it('should return true when new fragments exist after last completed discovery', async () => {
    const lastCompletedAt = new Date('2024-01-01T12:00:00Z');
    mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue({
      id: 'log-1',
      status: 'completed',
      completedAt: lastCompletedAt,
    });
    mockPrisma.cognitiveFragment.count.mockResolvedValue(3);

    const result = await engine._hasNewFragments('user-1');

    expect(result).toBe(true);
    expect(mockPrisma.cognitiveFragment.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: { gt: lastCompletedAt },
      },
    });
  });

  it('should return false when no new fragments exist after last completed discovery', async () => {
    const lastCompletedAt = new Date('2024-01-01T12:00:00Z');
    mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue({
      id: 'log-1',
      status: 'completed',
      completedAt: lastCompletedAt,
    });
    mockPrisma.cognitiveFragment.count.mockResolvedValue(0);

    const result = await engine._hasNewFragments('user-1');

    expect(result).toBe(false);
  });

  it('should query the most recent completed log entry', async () => {
    const recentCompletedAt = new Date('2024-06-01T12:00:00Z');
    mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue({
      id: 'log-recent',
      status: 'completed',
      completedAt: recentCompletedAt,
    });
    mockPrisma.cognitiveFragment.count.mockResolvedValue(1);

    await engine._hasNewFragments('user-1');

    expect(mockPrisma.themeDiscoveryLog.findFirst).toHaveBeenCalledWith({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });
    expect(mockPrisma.cognitiveFragment.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: { gt: recentCompletedAt },
      },
    });
  });

  it('should pass the correct userId to the fragment count query', async () => {
    const lastCompletedAt = new Date('2024-01-01T00:00:00Z');
    mockPrisma.themeDiscoveryLog.findFirst.mockResolvedValue({
      id: 'log-1',
      status: 'completed',
      completedAt: lastCompletedAt,
    });
    mockPrisma.cognitiveFragment.count.mockResolvedValue(0);

    await engine._hasNewFragments('specific-user-id');

    expect(mockPrisma.cognitiveFragment.count).toHaveBeenCalledWith({
      where: {
        userId: 'specific-user-id',
        createdAt: { gt: lastCompletedAt },
      },
    });
  });
});
