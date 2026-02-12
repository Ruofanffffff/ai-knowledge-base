/**
 * Unit Tests for Knowledge Graph Service
 */

const kgService = require('./kg_service');
const ckbParser = require('../ckb/ckb_parser');
const fieldExtractor = require('../field_extractor/field_extractor');
const schemaManager = require('../schema/schema_manager');
const schemaMatcher = require('../schema/schema_matcher');
const entityBuilder = require('../entity/entity_builder');
const entityStore = require('../entity/entity_store');

// Mock all dependencies
jest.mock('../ckb/ckb_parser');
jest.mock('../field_extractor/field_extractor');
jest.mock('../schema/schema_manager');
jest.mock('../schema/schema_matcher');
jest.mock('../entity/entity_builder');
jest.mock('../entity/entity_store');
jest.mock('../relation/builtin_relation_builder');
jest.mock('../relation/cooccurrence_relation_builder');
jest.mock('../relation/semantic_relation_builder');
jest.mock('../confidence/confidence_engine');
jest.mock('../confidence/quality_filter');

describe('Knowledge Graph Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks
    entityStore.getEntities = jest.fn();
    entityStore.getEntity = jest.fn();
  });

  describe('buildKnowledgeGraph', () => {
    it('should build knowledge graph from document', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          content: { text: 'Test content' },
          entities: []
        }
      ];

      const mockSchemas = [
        {
          id: 'schema_001',
          name: 'Test Schema',
          threshold: 0.7
        }
      ];

      const mockEntity = {
        id: 'entity_001',
        canonical_name: 'Test Entity'
      };

      ckbParser.parseDocument.mockResolvedValue(mockCKBs);
      fieldExtractor.extractFields.mockResolvedValue([
        { name: 'field1', value: 'value1' }
      ]);
      schemaManager.listSchemas.mockResolvedValue(mockSchemas);
      schemaMatcher.matchSchemas.mockResolvedValue([
        {
          schema: mockSchemas[0],
          completeness: 0.8
        }
      ]);
      entityBuilder.buildEntity.mockResolvedValue(mockEntity);
      entityStore.getEntities.mockResolvedValue([mockEntity]);

      const result = await kgService.buildKnowledgeGraph(
        'doc_123',
        '/path/to/file.pdf',
        'pdf'
      );

      expect(result.doc_id).toBe('doc_123');
      expect(result.ckbs_created).toBe(1);
      expect(result.processing_time).toBeGreaterThanOrEqual(0);
      expect(ckbParser.parseDocument).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      ckbParser.parseDocument.mockRejectedValue(new Error('Parse error'));

      await expect(
        kgService.buildKnowledgeGraph('doc_123', '/path/to/file.pdf', 'pdf')
      ).rejects.toThrow('Parse error');
    });

    it('should skip semantic relations if LLM not provided', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          content: { text: 'Test' },
          entities: []
        }
      ];

      ckbParser.parseDocument.mockResolvedValue(mockCKBs);
      fieldExtractor.extractFields.mockResolvedValue([]);
      schemaManager.listSchemas.mockResolvedValue([]);
      entityStore.getEntities.mockResolvedValue([]);

      const result = await kgService.buildKnowledgeGraph(
        'doc_123',
        '/path/to/file.pdf',
        'pdf',
        { enableSemanticRelations: true, llmClient: null }
      );

      expect(result.relations_created.semantic).toBe(0);
    });
  });

  describe('updateKnowledgeGraph', () => {
    it('should update knowledge graph incrementally', async () => {
      const mockCKBs = [
        {
          ckb_id: 'ckb_001',
          content: { text: 'Updated content' }
        }
      ];

      const mockEntities = [
        { id: 'entity_001', confidence: 0.8 }
      ];

      const ckbStore = require('../ckb/ckb_store');
      ckbStore.getCKBsByDocument = jest.fn().mockResolvedValue(mockCKBs);
      
      fieldExtractor.extractFields.mockResolvedValue([]);
      entityStore.getEntities.mockResolvedValue(mockEntities);

      const confidenceEngine = require('../confidence/confidence_engine');
      confidenceEngine.updateEntityConfidence.mockResolvedValue({
        updated: 1,
        deleted: 0,
        cascaded: { updated: 0, deleted: 0 }
      });

      const result = await kgService.updateKnowledgeGraph('doc_123');

      expect(result.doc_id).toBe('doc_123');
      expect(result.ckbs_updated).toBe(1);
      expect(result.processing_time).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deleteKnowledgeGraph', () => {
    it('should delete knowledge graph data for document', async () => {
      const mockCKBs = [
        { ckb_id: 'ckb_001' },
        { ckb_id: 'ckb_002' }
      ];

      const mockEntities = [
        { id: 'entity_001' }
      ];

      const ckbStore = require('../ckb/ckb_store');
      ckbStore.getCKBsByDocument = jest.fn().mockResolvedValue(mockCKBs);
      ckbStore.deleteCKB = jest.fn().mockResolvedValue(true);

      entityStore.getEntities.mockResolvedValue(mockEntities);

      const cooccurrenceRelationBuilder = require('../relation/cooccurrence_relation_builder');
      cooccurrenceRelationBuilder.removeCooccurrenceRelations = jest.fn()
        .mockResolvedValue({ deleted: 1 });

      const confidenceEngine = require('../confidence/confidence_engine');
      confidenceEngine.updateEntityConfidence.mockResolvedValue({
        updated: 0,
        deleted: 1,
        cascaded: 2
      });

      const result = await kgService.deleteKnowledgeGraph('doc_123');

      expect(result.doc_id).toBe('doc_123');
      expect(result.ckbs_deleted).toBe(2);
      expect(ckbStore.deleteCKB).toHaveBeenCalledTimes(2);
    });
  });

  describe('getKnowledgeGraphStats', () => {
    it('should return knowledge graph statistics', async () => {
      const mockEntities = [
        { id: 'e1', entity_type: 'person' },
        { id: 'e2', entity_type: 'location' }
      ];

      const mockRelations = [
        { id: 'r1', type: 'builtin' },
        { id: 'r2', type: 'semantic' }
      ];

      const mockCKBs = [
        { ckb_id: 'ckb_001' }
      ];

      entityStore.getAllEntities.mockResolvedValue(mockEntities);
      
      const relationStore = require('../relation/relation_store');
      relationStore.getAllRelations = jest.fn().mockResolvedValue(mockRelations);

      const ckbStore = require('../ckb/ckb_store');
      ckbStore.getAllCKBs = jest.fn().mockResolvedValue(mockCKBs);

      const confidenceEngine = require('../confidence/confidence_engine');
      confidenceEngine.getConfidenceStats.mockResolvedValue({
        entities: { avg_confidence: 0.8 },
        relations: { avg_confidence: 0.7 }
      });

      const stats = await kgService.getKnowledgeGraphStats();

      expect(stats.entity_count).toBe(2);
      expect(stats.relation_count).toBe(2);
      expect(stats.ckb_count).toBe(1);
      expect(stats.entity_types).toHaveProperty('person');
      expect(stats.relation_types).toHaveProperty('builtin');
    });
  });
});

describe('normalizePunctuation', () => {
  const { normalizePunctuation } = require('./kg_service');

  test('should convert Chinese colon to ASCII colon', () => {
    expect(normalizePunctuation('标题：副标题')).toBe('标题:副标题');
  });

  test('should convert double em-dash to hyphen', () => {
    expect(normalizePunctuation('标题——副标题')).toBe('标题-副标题');
  });

  test('should convert single em-dash to hyphen', () => {
    expect(normalizePunctuation('标题—副标题')).toBe('标题-副标题');
  });

  test('should convert Chinese semicolon to ASCII semicolon', () => {
    expect(normalizePunctuation('项目；版本')).toBe('项目;版本');
  });

  test('should convert Chinese comma to ASCII comma', () => {
    expect(normalizePunctuation('名称，描述')).toBe('名称,描述');
  });

  test('should convert Chinese period to ASCII period', () => {
    expect(normalizePunctuation('结束。开始')).toBe('结束.开始');
  });

  test('should handle multiple punctuation types in one string', () => {
    expect(normalizePunctuation('标题：内容——说明；备注，附加。结束')).toBe('标题:内容-说明;备注,附加.结束');
  });

  test('should handle double em-dash before single em-dash (no partial match)', () => {
    expect(normalizePunctuation('A——B—C')).toBe('A-B-C');
  });

  test('should return empty string for null/undefined/empty input', () => {
    expect(normalizePunctuation(null)).toBe('');
    expect(normalizePunctuation(undefined)).toBe('');
    expect(normalizePunctuation('')).toBe('');
  });

  test('should not modify strings without Chinese punctuation', () => {
    expect(normalizePunctuation('hello-world:test')).toBe('hello-world:test');
  });
});
