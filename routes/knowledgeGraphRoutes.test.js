/**
 * Knowledge Graph API Integration Tests
 */

const request = require('supertest');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const knowledgeGraphRoutes = require('./knowledgeGraphRoutes');
const { createCKB } = require('../kg/ckb/ckb_factory');
const ckbStore = require('../kg/ckb/ckb_store');
const entityStore = require('../kg/entity/entity_store');

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(express.json());

// Generate test JWT token
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const testToken = jwt.sign({ userId: 'test-user-123' }, JWT_SECRET, { expiresIn: '1h' });

app.use('/api/knowledge-graph', knowledgeGraphRoutes);

describe('Knowledge Graph API Integration Tests', () => {
  let testDocId;
  let testCKBId;
  let testEntityId;
  
  beforeAll(async () => {
    // Create a test document
    testDocId = 'test-doc-' + Date.now();
    
    try {
      await prisma.document.create({
        data: {
          id: testDocId,
          title: 'Test Document',
          content: 'Test content',
          type: 'document'
        }
      });
    } catch (error) {
      console.log('Test document may already exist');
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      // Clean up entities
      if (testEntityId) {
        await prisma.kGEntity.delete({
          where: { id: testEntityId }
        }).catch(() => {});
      }
      
      // Clean up test entities
      await prisma.kGEntity.deleteMany({
        where: { id: { startsWith: 'test-entity-' } }
      });
      
      // Clean up CKBs
      await prisma.cKB.deleteMany({
        where: { docId: testDocId }
      });
      
      // Clean up document
      await prisma.document.delete({
        where: { id: testDocId }
      });
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
    
    await prisma.$disconnect();
  });
  
  describe('GET /api/knowledge-graph/ckb', () => {
    test('should return list of CKBs', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/ckb')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.body.data.ckbs)).toBe(true);
    });
    
    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/ckb?skip=0&take=5')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.ckbs.length).toBeLessThanOrEqual(5);
    });
  });
  
  describe('CKB CRUD Operations', () => {
    test('should create and retrieve CKB', async () => {
      // Create a CKB directly using the store
      const ckb = createCKB({
        docId: testDocId,
        sourceType: 'word',
        text: 'This is a test CKB for integration testing.',
        sourceMeta: { test: true }
      });
      
      const saved = await ckbStore.saveCKB(ckb);
      testCKBId = saved.id;
      
      expect(saved).toBeDefined();
      expect(saved.id).toBe(ckb.ckb_id);
      
      // Retrieve the CKB via API
      const response = await request(app)
        .get(`/api/knowledge-graph/ckb/${testCKBId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testCKBId);
      expect(response.body.data.docId).toBe(testDocId);
    });
    
    test('should return 404 for non-existent CKB', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/ckb/non-existent-id')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('CKB not found');
    });
    
    test('should get CKBs by document ID', async () => {
      const response = await request(app)
        .get(`/api/knowledge-graph/ckb/document/${testDocId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data.ckbs)).toBe(true);
      
      // Verify all CKBs belong to the test document
      response.body.data.ckbs.forEach(ckb => {
        expect(ckb.docId).toBe(testDocId);
      });
    });
  });
  
  describe('GET /api/knowledge-graph/stats', () => {
    test('should return knowledge graph statistics', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data.ckb_count).toBe('number');
      expect(response.body.data.ckb_count).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Schema Routes', () => {
    test('GET /api/knowledge-graph/schemas should return schemas list', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/schemas')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('schemas');
      expect(Array.isArray(response.body.data.schemas)).toBe(true);
    });
    
    test('GET /api/knowledge-graph/schemas should support filtering by scene', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/schemas?scene=科研/政府')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.schemas)).toBe(true);
    });
    
    test('GET /api/knowledge-graph/schemas should support pagination', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/schemas?skip=0&take=10')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.schemas.length).toBeLessThanOrEqual(10);
    });
  });
  
  describe('Relation Routes', () => {
    test('GET /api/knowledge-graph/relations should return relations list', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/relations')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('relations');
      expect(Array.isArray(response.body.data.relations)).toBe(true);
    });
    
    test('GET /api/knowledge-graph/relations/stats should return relation statistics', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/relations/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('by_type');
      expect(response.body.data).toHaveProperty('average_confidence');
      expect(typeof response.body.data.total).toBe('number');
    });
  });
  
  describe('Entity Routes', () => {
    beforeAll(async () => {
      // Create test entities
      const testEntity = {
        entity_id: 'test-entity-' + Date.now(),
        entity_type: 'EventEntity',
        canonical_name: '测试实体_API_2025-01',
        aliases: ['测试实体API'],
        schemas: [{ schema_name: 'Test Schema', confidence: 0.9 }],
        supported_by: [testCKBId || 'test-ckb-001'],
        attributes: { 测试字段: '测试值' },
        confidence: 0.85,
        llm_enriched: false
      };
      
      const saved = await entityStore.saveEntity(testEntity);
      testEntityId = saved.entity_id;
    });
    
    test('GET /api/knowledge-graph/entities should return entities list', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('entities');
      expect(Array.isArray(response.body.data.entities)).toBe(true);
    });
    
    test('GET /api/knowledge-graph/entities should support filtering by type', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities?type=EventEntity')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.entities)).toBe(true);
      
      // Verify all entities are of the requested type
      if (response.body.data.entities.length > 0) {
        response.body.data.entities.forEach(entity => {
          expect(entity.entity_type).toBe('EventEntity');
        });
      }
    });
    
    test('GET /api/knowledge-graph/entities should support confidence filtering', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities?minConfidence=0.8&maxConfidence=1.0')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.entities)).toBe(true);
      
      // Verify all entities meet confidence criteria
      response.body.data.entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0.8);
        expect(entity.confidence).toBeLessThanOrEqual(1.0);
      });
    });
    
    test('GET /api/knowledge-graph/entities should support pagination', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities?skip=0&take=5')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.entities.length).toBeLessThanOrEqual(5);
    });
    
    test('GET /api/knowledge-graph/entities/:id should return entity by ID', async () => {
      const response = await request(app)
        .get(`/api/knowledge-graph/entities/${testEntityId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.entity_id).toBe(testEntityId);
      expect(response.body.data.canonical_name).toBe('测试实体_API_2025-01');
    });
    
    test('GET /api/knowledge-graph/entities/:id should return 404 for non-existent entity', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities/non-existent-id')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Entity not found');
    });
    
    test('GET /api/knowledge-graph/entities/:id should include CKBs when requested', async () => {
      const response = await request(app)
        .get(`/api/knowledge-graph/entities/${testEntityId}?includeCKBs=true`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.entity_id).toBe(testEntityId);
      // supporting_ckbs may be empty if CKBs don't exist
      expect(response.body.data).toHaveProperty('supporting_ckbs');
    });
    
    test('GET /api/knowledge-graph/entities/search should search entities', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities/search?q=测试')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('query');
      expect(response.body.data.query).toBe('测试');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.entities)).toBe(true);
      
      // Verify search results contain the query term
      if (response.body.data.entities.length > 0) {
        const found = response.body.data.entities.some(entity => 
          entity.canonical_name.includes('测试') || 
          entity.aliases.some(alias => alias.includes('测试'))
        );
        expect(found).toBe(true);
      }
    });
    
    test('GET /api/knowledge-graph/entities/search should require query parameter', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities/search')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required parameter');
    });
    
    test('GET /api/knowledge-graph/entities/stats should return entity statistics', async () => {
      const response = await request(app)
        .get('/api/knowledge-graph/entities/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('by_type');
      expect(response.body.data).toHaveProperty('average_confidence');
      expect(typeof response.body.data.total).toBe('number');
      expect(typeof response.body.data.average_confidence).toBe('number');
    });
  });
});
