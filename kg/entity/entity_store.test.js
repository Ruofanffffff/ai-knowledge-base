/**
 * Entity Store Tests
 * 
 * Tests for entity persistence and retrieval operations.
 */

const {
  saveEntity,
  saveEntities,
  getEntityById,
  getEntityByCanonicalName,
  getEntitiesByType,
  searchEntities,
  getEntitiesByConfidence,
  getEntitiesByCKB,
  updateEntity,
  deleteEntity,
  deleteEntitiesByConfidence,
  getAllEntities,
  countEntities,
  getEntityStats,
  findSimilarEntities,
  serializeEntity,
  deserializeEntity,
  calculateNameSimilarity,
  levenshteinDistance
} = require('./entity_store');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Test data
const createTestEntity = (overrides = {}) => ({
  entity_id: `entity_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  entity_type: 'EventEntity',
  canonical_name: '阿里C区_水位_2025-01',
  aliases: ['阿里C区水位2025-01', '阿里C区水位下降'],
  schemas: [
    { schema_name: '地下水位变化事件', confidence: 0.92 }
  ],
  supported_by: ['ckb_001', 'ckb_002'],
  attributes: {
    区域: '阿里C区',
    时间: '2025-01',
    指标: '水位',
    数值: '10',
    单位: '米'
  },
  confidence: 0.9,
  llm_enriched: false,
  ...overrides
});

describe('Entity Store', () => {
  // Clean up test data after each test
  afterEach(async () => {
    await prisma.kGEntity.deleteMany({
      where: {
        id: { startsWith: 'entity_test_' }
      }
    });
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  describe('Serialization and Deserialization', () => {
    test('should serialize entity correctly', () => {
      const entity = createTestEntity();
      const serialized = serializeEntity(entity);
      
      expect(serialized.id).toBe(entity.entity_id);
      expect(serialized.type).toBe(entity.entity_type);
      expect(serialized.canonicalName).toBe(entity.canonical_name);
      expect(typeof serialized.aliases).toBe('string');
      expect(typeof serialized.schemas).toBe('string');
      expect(typeof serialized.supportedBy).toBe('string');
      expect(typeof serialized.attributes).toBe('string');
      expect(serialized.confidence).toBe(entity.confidence);
      expect(serialized.llmEnriched).toBe(entity.llm_enriched);
    });
    
    test('should deserialize entity correctly', () => {
      const dbEntity = {
        id: 'entity_001',
        type: 'EventEntity',
        canonicalName: '阿里C区_水位_2025-01',
        aliases: JSON.stringify(['阿里C区水位2025-01']),
        schemas: JSON.stringify([{ schema_name: '地下水位变化事件', confidence: 0.92 }]),
        supportedBy: JSON.stringify(['ckb_001']),
        attributes: JSON.stringify({ 区域: '阿里C区' }),
        confidence: 0.9,
        llmEnriched: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const deserialized = deserializeEntity(dbEntity);
      
      expect(deserialized.entity_id).toBe(dbEntity.id);
      expect(deserialized.entity_type).toBe(dbEntity.type);
      expect(deserialized.canonical_name).toBe(dbEntity.canonicalName);
      expect(Array.isArray(deserialized.aliases)).toBe(true);
      expect(Array.isArray(deserialized.schemas)).toBe(true);
      expect(Array.isArray(deserialized.supported_by)).toBe(true);
      expect(typeof deserialized.attributes).toBe('object');
      expect(deserialized.confidence).toBe(dbEntity.confidence);
      expect(deserialized.llm_enriched).toBe(dbEntity.llmEnriched);
    });
    
    test('should handle null entity in deserialization', () => {
      const result = deserializeEntity(null);
      expect(result).toBeNull();
    });
  });
  
  describe('Save Operations', () => {
    test('should save entity successfully', async () => {
      const entity = createTestEntity();
      const saved = await saveEntity(entity);
      
      expect(saved).toBeDefined();
      expect(saved.entity_id).toBe(entity.entity_id);
      expect(saved.canonical_name).toBe(entity.canonical_name);
      expect(saved.confidence).toBe(entity.confidence);
      expect(saved.created_at).toBeDefined();
      expect(saved.updated_at).toBeDefined();
    });
    
    test('should update existing entity on save', async () => {
      const entity = createTestEntity();
      await saveEntity(entity);
      
      // Update entity
      entity.confidence = 0.95;
      entity.supported_by.push('ckb_003');
      
      const updated = await saveEntity(entity);
      
      expect(updated.confidence).toBe(0.95);
      expect(updated.supported_by).toContain('ckb_003');
      expect(updated.supported_by.length).toBe(3);
    });
    
    test('should save multiple entities in transaction', async () => {
      const entities = [
        createTestEntity({ canonical_name: 'Entity_1' }),
        createTestEntity({ canonical_name: 'Entity_2' }),
        createTestEntity({ canonical_name: 'Entity_3' })
      ];
      
      const saved = await saveEntities(entities);
      
      expect(saved.length).toBe(3);
      expect(saved[0].canonical_name).toBe('Entity_1');
      expect(saved[1].canonical_name).toBe('Entity_2');
      expect(saved[2].canonical_name).toBe('Entity_3');
    });
  });
  
  describe('Retrieval Operations', () => {
    test('should get entity by ID', async () => {
      const entity = createTestEntity();
      await saveEntity(entity);
      
      const retrieved = await getEntityById(entity.entity_id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.entity_id).toBe(entity.entity_id);
      expect(retrieved.canonical_name).toBe(entity.canonical_name);
    });
    
    test('should return null for non-existent entity ID', async () => {
      const retrieved = await getEntityById('non_existent_id');
      expect(retrieved).toBeNull();
    });
    
    test('should get entity by canonical name', async () => {
      const entity = createTestEntity();
      await saveEntity(entity);
      
      const retrieved = await getEntityByCanonicalName(entity.canonical_name);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.canonical_name).toBe(entity.canonical_name);
    });
    
    test('should get entities by type', async () => {
      await saveEntities([
        createTestEntity({ entity_type: 'EventEntity', canonical_name: 'Event_1' }),
        createTestEntity({ entity_type: 'EventEntity', canonical_name: 'Event_2' }),
        createTestEntity({ entity_type: 'LocationEntity', canonical_name: 'Location_1' })
      ]);
      
      const eventEntities = await getEntitiesByType('EventEntity');
      
      expect(eventEntities.length).toBeGreaterThanOrEqual(2);
      expect(eventEntities.every(e => e.entity_type === 'EventEntity')).toBe(true);
    });
    
    test('should support pagination in getEntitiesByType', async () => {
      await saveEntities([
        createTestEntity({ canonical_name: 'Entity_1' }),
        createTestEntity({ canonical_name: 'Entity_2' }),
        createTestEntity({ canonical_name: 'Entity_3' })
      ]);
      
      const page1 = await getEntitiesByType('EventEntity', { skip: 0, take: 2 });
      const page2 = await getEntitiesByType('EventEntity', { skip: 2, take: 2 });
      
      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page2.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Search Operations', () => {
    test('should search entities by canonical name', async () => {
      const testEntities = await saveEntities([
        createTestEntity({ canonical_name: '阿里C区_水位_2025-01' }),
        createTestEntity({ canonical_name: '阿里D区_温度_2025-02' }),
        createTestEntity({ canonical_name: '北京_降雨_2025-03' })
      ]);
      
      const results = await searchEntities('阿里');
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Check that our test entities with '阿里' are in the results
      const aliEntities = testEntities.filter(e => e.canonical_name.includes('阿里'));
      const foundAliEntities = results.filter(e => 
        aliEntities.some(ae => ae.entity_id === e.entity_id)
      );
      expect(foundAliEntities.length).toBe(2);
      expect(foundAliEntities.every(e => e.canonical_name.includes('阿里'))).toBe(true);
    });
    
    test('should search entities by alias', async () => {
      const entity = createTestEntity({
        canonical_name: '阿里C区_水位_2025-01',
        aliases: ['阿里C区水位2025-01', '阿里C区水位下降']
      });
      await saveEntity(entity);
      
      const results = await searchEntities('水位下降');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      const found = results.find(e => e.entity_id === entity.entity_id);
      expect(found).toBeDefined();
    });
  });
  
  describe('Confidence-based Operations', () => {
    test('should get entities by confidence range', async () => {
      await saveEntities([
        createTestEntity({ canonical_name: 'High_Conf', confidence: 0.95 }),
        createTestEntity({ canonical_name: 'Med_Conf', confidence: 0.75 }),
        createTestEntity({ canonical_name: 'Low_Conf', confidence: 0.55 })
      ]);
      
      const highConfEntities = await getEntitiesByConfidence(0.8, 1.0);
      
      expect(highConfEntities.length).toBeGreaterThanOrEqual(1);
      expect(highConfEntities.every(e => e.confidence >= 0.8)).toBe(true);
    });
    
    test('should filter by entity type in confidence query', async () => {
      await saveEntities([
        createTestEntity({ entity_type: 'EventEntity', confidence: 0.9 }),
        createTestEntity({ entity_type: 'LocationEntity', confidence: 0.9 })
      ]);
      
      const results = await getEntitiesByConfidence(0.8, 1.0, { entityType: 'EventEntity' });
      
      expect(results.every(e => e.entity_type === 'EventEntity')).toBe(true);
    });
    
    test('should delete entities by confidence threshold', async () => {
      const lowConfEntity = createTestEntity({ confidence: 0.3 });
      const highConfEntity = createTestEntity({ confidence: 0.9 });
      
      await saveEntities([lowConfEntity, highConfEntity]);
      
      const deletedCount = await deleteEntitiesByConfidence(0.5);
      
      expect(deletedCount).toBeGreaterThanOrEqual(1);
      
      const remaining = await getEntityById(lowConfEntity.entity_id);
      expect(remaining).toBeNull();
      
      const stillExists = await getEntityById(highConfEntity.entity_id);
      expect(stillExists).toBeDefined();
    });
  });
  
  describe('CKB-based Operations', () => {
    test('should get entities by CKB ID', async () => {
      await saveEntities([
        createTestEntity({ supported_by: ['ckb_001', 'ckb_002'] }),
        createTestEntity({ supported_by: ['ckb_001', 'ckb_003'] }),
        createTestEntity({ supported_by: ['ckb_004'] })
      ]);
      
      const entities = await getEntitiesByCKB('ckb_001');
      
      expect(entities.length).toBeGreaterThanOrEqual(2);
      expect(entities.every(e => e.supported_by.includes('ckb_001'))).toBe(true);
    });
  });
  
  describe('Update Operations', () => {
    test('should update entity fields', async () => {
      const entity = createTestEntity();
      await saveEntity(entity);
      
      const updated = await updateEntity(entity.entity_id, {
        confidence: 0.95,
        aliases: ['新别名1', '新别名2']
      });
      
      expect(updated.confidence).toBe(0.95);
      expect(updated.aliases).toContain('新别名1');
      expect(updated.aliases).toContain('新别名2');
    });
    
    test('should update supported_by list', async () => {
      const entity = createTestEntity({ supported_by: ['ckb_001'] });
      await saveEntity(entity);
      
      const updated = await updateEntity(entity.entity_id, {
        supported_by: ['ckb_001', 'ckb_002', 'ckb_003']
      });
      
      expect(updated.supported_by.length).toBe(3);
      expect(updated.supported_by).toContain('ckb_003');
    });
  });
  
  describe('Delete Operations', () => {
    test('should delete entity by ID', async () => {
      const entity = createTestEntity();
      await saveEntity(entity);
      
      await deleteEntity(entity.entity_id);
      
      const retrieved = await getEntityById(entity.entity_id);
      expect(retrieved).toBeNull();
    });
  });
  
  describe('Statistics Operations', () => {
    test('should count entities', async () => {
      const initialCount = await countEntities();
      
      await saveEntities([
        createTestEntity(),
        createTestEntity(),
        createTestEntity()
      ]);
      
      const newCount = await countEntities();
      expect(newCount).toBe(initialCount + 3);
    });
    
    test('should get entity statistics', async () => {
      await saveEntities([
        createTestEntity({ entity_type: 'EventEntity', confidence: 0.9 }),
        createTestEntity({ entity_type: 'EventEntity', confidence: 0.8 }),
        createTestEntity({ entity_type: 'LocationEntity', confidence: 0.7 })
      ]);
      
      const stats = await getEntityStats();
      
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.by_type).toBeDefined();
      expect(stats.by_type.EventEntity).toBeGreaterThanOrEqual(2);
      expect(stats.average_confidence).toBeGreaterThan(0);
    });
  });
  
  describe('Similarity Operations', () => {
    test('should find similar entities', async () => {
      await saveEntities([
        createTestEntity({ canonical_name: '阿里C区_水位_2025-01' }),
        createTestEntity({ canonical_name: '阿里C区_水位_2025-02' }),
        createTestEntity({ canonical_name: '北京_降雨_2025-01' })
      ]);
      
      const similar = await findSimilarEntities('阿里C区_水位_2025-03', 'EventEntity', 0.7);
      
      expect(similar.length).toBeGreaterThanOrEqual(2);
      expect(similar[0].similarity).toBeGreaterThan(0.7);
      expect(similar[0].similarity).toBeGreaterThanOrEqual(similar[1].similarity);
    });
    
    test('should calculate name similarity correctly', () => {
      expect(calculateNameSimilarity('阿里C区', '阿里C区')).toBe(1.0);
      expect(calculateNameSimilarity('阿里C区', '阿里D区')).toBeGreaterThan(0.7);
      expect(calculateNameSimilarity('阿里C区', '北京市')).toBeLessThan(0.5);
    });
    
    test('should calculate Levenshtein distance correctly', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(levenshteinDistance('abc', 'abc')).toBe(0);
    });
  });
  
  describe('Pagination and Ordering', () => {
    test('should get all entities with pagination', async () => {
      await saveEntities([
        createTestEntity({ canonical_name: 'Entity_1' }),
        createTestEntity({ canonical_name: 'Entity_2' }),
        createTestEntity({ canonical_name: 'Entity_3' })
      ]);
      
      const page1 = await getAllEntities({ skip: 0, take: 2 });
      const page2 = await getAllEntities({ skip: 2, take: 2 });
      
      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page2.length).toBeGreaterThanOrEqual(1);
    });
    
    test('should order entities by confidence', async () => {
      await saveEntities([
        createTestEntity({ canonical_name: 'Low', confidence: 0.6 }),
        createTestEntity({ canonical_name: 'High', confidence: 0.9 }),
        createTestEntity({ canonical_name: 'Med', confidence: 0.75 })
      ]);
      
      const ordered = await getAllEntities({ orderBy: 'confidence', order: 'desc', take: 10 });
      
      // Check that confidence is in descending order
      for (let i = 0; i < ordered.length - 1; i++) {
        expect(ordered[i].confidence).toBeGreaterThanOrEqual(ordered[i + 1].confidence);
      }
    });
  });
});
