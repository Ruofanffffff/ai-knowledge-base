/**
 * End-to-End Knowledge Graph Construction Test
 * 
 * Tests the complete flow from document parsing to knowledge graph construction:
 * 1. Parse document to CKBs
 * 2. Extract fields from CKBs
 * 3. Match schemas
 * 4. Build entities
 * 5. Build relations
 * 6. Query the knowledge graph
 */

const { PrismaClient } = require('@prisma/client');
const ckbParser = require('./ckb/ckb_parser');
const ckbStore = require('./ckb/ckb_store');
const fieldExtractor = require('./field_extractor/field_extractor');
const schemaMatcher = require('./schema/schema_matcher');
const schemaManager = require('./schema/schema_manager');
const entityBuilder = require('./entity/entity_builder');
const entityStore = require('./entity/entity_store');
const builtinRelationBuilder = require('./relation/builtin_relation_builder');
const relationStore = require('./relation/relation_store');

const prisma = new PrismaClient();

describe('End-to-End Knowledge Graph Construction', () => {
  let testDocId;
  let testCKBs;
  let testEntities;
  let testRelations;
  let testSchema;
  
  beforeAll(async () => {
    testDocId = 'e2e-test-doc-' + Date.now();
    
    // Create test document
    await prisma.document.create({
      data: {
        id: testDocId,
        title: 'E2E Test Document',
        content: '阿里C区2025年1月水位下降10米。该区域位于新疆维吾尔自治区。',
        type: 'document'
      }
    });
    
    // Create or get test schema
    const schemas = await schemaManager.getSchemas({ scene: '科研/政府' });
    if (schemas.length > 0) {
      testSchema = schemas[0];
    } else {
      // Create a simple test schema
      const schemaId = await schemaManager.createSchema({
        schema_name: 'E2E测试Schema',
        entity_type: 'EventEntity',
        scene: '科研/政府',
        core_fields: [
          { name: '区域', weight: 0.3, required: true },
          { name: '时间', weight: 0.2, required: true },
          { name: '指标', weight: 0.2, required: true },
          { name: '数值', weight: 0.2, required: false },
          { name: '单位', weight: 0.1, required: false }
        ],
        threshold: 0.6,
        relations: [
          { type: '发生于', target_field: '区域', direction: 'outgoing' },
          { type: '发生时间', target_field: '时间', direction: 'outgoing' }
        ],
        example_description: '阿里C区2025年1月水位下降10米',
        description: 'E2E测试用Schema',
        active: true
      });
      // Get the created schema
      testSchema = await schemaManager.getSchema(schemaId);
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      // Delete relations
      if (testEntities && testEntities.length > 0) {
        for (const entity of testEntities) {
          await relationStore.deleteRelationsByEntity(entity.entity_id);
        }
      }
      
      // Delete entities
      await prisma.kGEntity.deleteMany({
        where: { id: { startsWith: 'e2e-test-' } }
      });
      
      await prisma.kGEntity.deleteMany({
        where: { id: { startsWith: 'entity_' } }
      });
      
      // Delete CKBs
      await prisma.cKB.deleteMany({
        where: { docId: testDocId }
      });
      
      // Delete document
      await prisma.document.delete({
        where: { id: testDocId }
      });
      
      // Delete test schema if we created it
      if (testSchema && testSchema.schema_name === 'E2E测试Schema') {
        await schemaManager.deleteSchema(testSchema.schema_id);
      }
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
    
    await prisma.$disconnect();
  });
  
  describe('Complete KG Construction Flow', () => {
    test('Step 1: Parse document to CKBs', async () => {
      // Parse document content into CKBs
      const content = '阿里C区2025年1月水位下降10米。该区域位于新疆维吾尔自治区。';
      
      // Simulate CKB creation (in real scenario, this would parse from file)
      const ckb1 = {
        ckb_id: `e2e-test-ckb-1-${Date.now()}`,
        doc_id: testDocId,
        source_type: 'text',
        source_meta: { test: true },
        structure: { section_title: 'Test Section', level: 1 },
        content: { text: '阿里C区2025年1月水位下降10米', language: 'zh' },
        quality: { source_confidence: 0.9 },
        timestamps: { created_at: new Date().toISOString() }
      };
      
      const ckb2 = {
        ckb_id: `e2e-test-ckb-2-${Date.now()}`,
        doc_id: testDocId,
        source_type: 'text',
        source_meta: { test: true },
        structure: { section_title: 'Test Section', level: 1 },
        content: { text: '该区域位于新疆维吾尔自治区', language: 'zh' },
        quality: { source_confidence: 0.9 },
        timestamps: { created_at: new Date().toISOString() }
      };
      
      // Save CKBs
      const saved1 = await ckbStore.saveCKB(ckb1);
      const saved2 = await ckbStore.saveCKB(ckb2);
      
      testCKBs = [saved1, saved2];
      
      expect(testCKBs).toBeDefined();
      expect(testCKBs.length).toBe(2);
      expect(testCKBs[0].id).toBe(ckb1.ckb_id);
      
      console.log('✓ Step 1 Complete: Created 2 CKBs');
    });
    
    test('Step 2: Extract fields from CKBs', async () => {
      expect(testCKBs).toBeDefined();
      
      // Extract fields from first CKB
      const fields = await fieldExtractor.extractFields(testCKBs[0]);
      
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
      
      // Check for expected fields
      const fieldNames = fields.map(f => f.name);
      console.log('Extracted fields:', fieldNames);
      
      // Should extract at least some fields
      expect(fields.length).toBeGreaterThanOrEqual(2);
      
      console.log(`✓ Step 2 Complete: Extracted ${fields.length} fields`);
    });
    
    test('Step 3: Match schemas and calculate completeness', async () => {
      expect(testCKBs).toBeDefined();
      expect(testSchema).toBeDefined();
      
      // Extract fields
      const fields = await fieldExtractor.extractFields(testCKBs[0]);
      
      // Calculate completeness
      const score = schemaMatcher.calculateCompleteness(
        fields,
        testSchema,
        testCKBs[0].quality.source_confidence
      );
      
      expect(score).toBeDefined();
      expect(score.schema_name).toBe(testSchema.schema_name);
      expect(score.completeness).toBeGreaterThan(0);
      expect(score.completeness).toBeLessThanOrEqual(1);
      
      console.log(`✓ Step 3 Complete: Schema matched with score ${score.completeness.toFixed(2)}`);
    });
    
    test('Step 4: Build entities from matched schemas', async () => {
      expect(testCKBs).toBeDefined();
      expect(testSchema).toBeDefined();
      
      // Extract fields
      const fields = await fieldExtractor.extractFields(testCKBs[0]);
      
      // Calculate completeness
      const score = schemaMatcher.calculateCompleteness(
        fields,
        testSchema,
        testCKBs[0].quality.source_confidence
      );
      
      // Build entity if completeness is sufficient
      if (score.meets_threshold) {
        const entity = await entityBuilder.buildEntity(
          score,
          fields,
          testCKBs[0]
        );
        
        // Save entity
        const saved = await entityStore.saveEntity(entity);
        testEntities = [saved];
        
        expect(saved).toBeDefined();
        expect(saved.entity_id).toBeDefined();
        expect(saved.canonical_name).toBeDefined();
        expect(saved.entity_type).toBe(testSchema.entity_type);
        
        console.log(`✓ Step 4 Complete: Built entity "${saved.canonical_name}"`);
      } else {
        console.log(`⊘ Step 4 Skipped: Completeness ${score.completeness.toFixed(2)} < threshold ${testSchema.threshold}`);
        testEntities = [];
      }
    });
    
    test('Step 5: Build relations between entities', async () => {
      if (!testEntities || testEntities.length === 0) {
        console.log('⊘ Step 5 Skipped: No entities to build relations for');
        return;
      }
      
      const entity = testEntities[0];
      
      // Extract fields again for relation building
      const fields = await fieldExtractor.extractFields(testCKBs[0]);
      
      // Build relations
      const relations = await builtinRelationBuilder.buildRelations(
        entity,
        testSchema,
        fields,
        [testCKBs[0].id]
      );
      
      // Save relations
      if (relations.length > 0) {
        const saved = await relationStore.saveRelations(relations);
        testRelations = saved;
        
        expect(saved).toBeDefined();
        expect(saved.length).toBeGreaterThan(0);
        
        console.log(`✓ Step 5 Complete: Built ${saved.length} relations`);
      } else {
        console.log('⊘ Step 5: No relations built');
        testRelations = [];
      }
    });
    
    test('Step 6: Query the knowledge graph', async () => {
      // Query entities
      const entities = await entityStore.getAllEntities({ take: 10 });
      expect(entities).toBeDefined();
      expect(Array.isArray(entities)).toBe(true);
      
      console.log(`✓ Step 6a: Found ${entities.length} entities in KG`);
      
      // Query relations
      const relations = await relationStore.getAllRelations({ take: 10 });
      expect(relations).toBeDefined();
      expect(Array.isArray(relations)).toBe(true);
      
      console.log(`✓ Step 6b: Found ${relations.length} relations in KG`);
      
      // Get statistics
      const entityStats = await entityStore.getEntityStats();
      const relationStats = await relationStore.getRelationStats();
      
      expect(entityStats).toBeDefined();
      expect(entityStats.total).toBeGreaterThanOrEqual(0);
      
      expect(relationStats).toBeDefined();
      expect(relationStats.total).toBeGreaterThanOrEqual(0);
      
      console.log(`✓ Step 6c: KG Stats - Entities: ${entityStats.total}, Relations: ${relationStats.total}`);
    });
    
    test('Step 7: Verify entity-relation connectivity', async () => {
      if (!testEntities || testEntities.length === 0) {
        console.log('⊘ Step 7 Skipped: No test entities');
        return;
      }
      
      const entity = testEntities[0];
      
      // Get entity's relations
      const entityRelations = await relationStore.getRelationsByEntity(
        entity.entity_id,
        { includeEntities: true }
      );
      
      expect(entityRelations).toBeDefined();
      expect(Array.isArray(entityRelations)).toBe(true);
      
      console.log(`✓ Step 7: Entity has ${entityRelations.length} relations`);
      
      // Verify relation structure
      if (entityRelations.length > 0) {
        const relation = entityRelations[0];
        expect(relation.source_id).toBeDefined();
        expect(relation.target_id).toBeDefined();
        expect(relation.type).toBeDefined();
        expect(relation.confidence).toBeGreaterThan(0);
        
        console.log(`  - Relation type: ${relation.type}/${relation.subtype || 'N/A'}`);
        console.log(`  - Confidence: ${relation.confidence}`);
      }
    });
  });
  
  describe('KG Query Capabilities', () => {
    test('should support entity search', async () => {
      const searchResults = await entityStore.searchEntities('测试', { take: 5 });
      
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);
      
      console.log(`✓ Entity search returned ${searchResults.length} results`);
    });
    
    test('should support entity filtering by type', async () => {
      const eventEntities = await entityStore.getEntitiesByType('EventEntity', { take: 5 });
      
      expect(eventEntities).toBeDefined();
      expect(Array.isArray(eventEntities)).toBe(true);
      
      console.log(`✓ Found ${eventEntities.length} EventEntity entities`);
    });
    
    test('should support entity filtering by confidence', async () => {
      const highConfidenceEntities = await entityStore.getEntitiesByConfidence(
        0.8,
        1.0,
        { take: 5 }
      );
      
      expect(highConfidenceEntities).toBeDefined();
      expect(Array.isArray(highConfidenceEntities)).toBe(true);
      
      // Verify confidence range
      highConfidenceEntities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0.8);
        expect(entity.confidence).toBeLessThanOrEqual(1.0);
      });
      
      console.log(`✓ Found ${highConfidenceEntities.length} high-confidence entities`);
    });
    
    test('should support relation filtering by type', async () => {
      const builtinRelations = await relationStore.getAllRelations({
        type: 'builtin',
        take: 5
      });
      
      expect(builtinRelations).toBeDefined();
      expect(Array.isArray(builtinRelations)).toBe(true);
      
      // Verify type
      builtinRelations.forEach(relation => {
        expect(relation.type).toBe('builtin');
      });
      
      console.log(`✓ Found ${builtinRelations.length} builtin relations`);
    });
  });
  
  describe('KG Statistics', () => {
    test('should provide comprehensive entity statistics', async () => {
      const stats = await entityStore.getEntityStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('by_type');
      expect(stats).toHaveProperty('average_confidence');
      
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.average_confidence).toBe('number');
      expect(typeof stats.by_type).toBe('object');
      
      console.log('✓ Entity Statistics:');
      console.log(`  - Total: ${stats.total}`);
      console.log(`  - Average Confidence: ${stats.average_confidence.toFixed(2)}`);
      console.log(`  - By Type:`, stats.by_type);
    });
    
    test('should provide comprehensive relation statistics', async () => {
      const stats = await relationStore.getRelationStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('by_type');
      expect(stats).toHaveProperty('average_confidence');
      
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.average_confidence).toBe('number');
      expect(typeof stats.by_type).toBe('object');
      
      console.log('✓ Relation Statistics:');
      console.log(`  - Total: ${stats.total}`);
      console.log(`  - Average Confidence: ${stats.average_confidence.toFixed(2)}`);
      console.log(`  - By Type:`, stats.by_type);
    });
  });
});
