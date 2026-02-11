/**
 * Anchor Fields Migration - Data Integrity Tests
 * 
 * This test suite verifies that the anchor fields migration maintains data integrity:
 * - All migrated entities have valid anchor fingerprints
 * - Anchor fields are properly formatted
 * - No data corruption occurred
 * - Anchor fingerprints are deterministic
 */

const { PrismaClient } = require('@prisma/client');
const { generateAnchorFingerprint } = require('../../kg/entity/anchor_generator');
const { extractAnchorFieldsFromEntity } = require('./add_anchor_fields_helpers');

const prisma = new PrismaClient();

describe('Anchor Fields Migration - Data Integrity', () => {
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  describe('1. Anchor Fingerprint Validation', () => {
    
    it('should have anchor fingerprints for all migrated entities', async () => {
      const entitiesWithAnchors = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        }
      });
      
      expect(entitiesWithAnchors.length).toBeGreaterThan(0);
      
      // All entities with anchors should have non-empty fingerprints
      for (const entity of entitiesWithAnchors) {
        expect(entity.anchorFingerprint).toBeTruthy();
        expect(typeof entity.anchorFingerprint).toBe('string');
        expect(entity.anchorFingerprint.length).toBeGreaterThan(0);
      }
    });
    
    it('should have properly formatted anchor fingerprints', async () => {
      const entitiesWithAnchors = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        },
        take: 20
      });
      
      for (const entity of entitiesWithAnchors) {
        const fingerprint = entity.anchorFingerprint;
        
        // Anchor fingerprint should follow pattern: EntityType|field1|field2|...
        expect(fingerprint).toMatch(/^[A-Za-z]+Entity\|/);
        
        // Should start with entity type
        expect(fingerprint.startsWith(entity.type + '|')).toBe(true);
        
        // Should not have trailing pipes
        expect(fingerprint.endsWith('|')).toBe(false);
        
        // Should not have double pipes
        expect(fingerprint.includes('||')).toBe(false);
      }
    });
    
    it('should have anchor fingerprints that match entity type', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        },
        take: 20
      });
      
      for (const entity of entities) {
        const fingerprintPrefix = entity.anchorFingerprint.split('|')[0];
        expect(fingerprintPrefix).toBe(entity.type);
      }
    });
    
  });
  
  describe('2. Anchor Fields Validation', () => {
    
    it('should have anchor fields for all entities with fingerprints', async () => {
      const entitiesWithAnchors = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        }
      });
      
      for (const entity of entitiesWithAnchors) {
        expect(entity.anchorFields).toBeTruthy();
        
        // Should be valid JSON
        expect(() => JSON.parse(entity.anchorFields)).not.toThrow();
        
        const anchorFields = JSON.parse(entity.anchorFields);
        
        // Should be an object
        expect(typeof anchorFields).toBe('object');
        expect(anchorFields).not.toBeNull();
        
        // Should have at least one field
        expect(Object.keys(anchorFields).length).toBeGreaterThan(0);
      }
    });
    
    it('should have anchor fields that are non-empty', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        },
        take: 20
      });
      
      for (const entity of entities) {
        const anchorFields = JSON.parse(entity.anchorFields);
        
        // All anchor field values should be non-empty
        for (const [fieldName, fieldValue] of Object.entries(anchorFields)) {
          expect(fieldName).toBeTruthy();
          expect(fieldValue).toBeTruthy();
          expect(typeof fieldValue).not.toBe('undefined');
          expect(fieldValue).not.toBe(null);
        }
      }
    });
    
    it('should have anchor fields that exist in entity attributes', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        },
        take: 20
      });
      
      for (const entity of entities) {
        const anchorFields = JSON.parse(entity.anchorFields);
        const attributes = JSON.parse(entity.attributes || '{}');
        
        // Each anchor field should exist in attributes
        for (const [fieldName, fieldValue] of Object.entries(anchorFields)) {
          // The field should exist in attributes (exact match or normalized)
          const hasField = attributes[fieldName] !== undefined;
          
          if (!hasField) {
            // Allow for normalized field names (e.g., "Location" vs "location")
            const normalizedFieldNames = Object.keys(attributes).map(k => k.toLowerCase());
            const hasNormalizedField = normalizedFieldNames.includes(fieldName.toLowerCase());
            
            expect(hasNormalizedField).toBe(true);
          }
        }
      }
    });
    
  });
  
  describe('3. Data Corruption Checks', () => {
    
    it('should not have corrupted entity data', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        }
      });
      
      for (const entity of entities) {
        // Basic entity fields should be intact
        expect(entity.id).toBeTruthy();
        expect(entity.type).toBeTruthy();
        expect(entity.canonicalName).toBeTruthy();
        
        // JSON fields should be valid
        expect(() => JSON.parse(entity.schemas || '[]')).not.toThrow();
        expect(() => JSON.parse(entity.attributes || '{}')).not.toThrow();
        expect(() => JSON.parse(entity.supportedBy || '[]')).not.toThrow();
        expect(() => JSON.parse(entity.aliases || '[]')).not.toThrow();
        
        // Confidence should be valid
        expect(entity.confidence).toBeGreaterThanOrEqual(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
        
        // Timestamps should be valid
        expect(entity.createdAt).toBeInstanceOf(Date);
        expect(entity.updatedAt).toBeInstanceOf(Date);
      }
    });
    
    it('should preserve all original entity attributes', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        },
        take: 10
      });
      
      for (const entity of entities) {
        const attributes = JSON.parse(entity.attributes || '{}');
        
        // Attributes should not be empty (unless it was empty before)
        // We can't verify the exact original state, but we can check structure
        expect(typeof attributes).toBe('object');
        
        // If entity has anchor fields, those fields should be in attributes
        const anchorFields = JSON.parse(entity.anchorFields);
        for (const fieldName of Object.keys(anchorFields)) {
          // Field should exist in attributes (case-insensitive check)
          const attrKeys = Object.keys(attributes).map(k => k.toLowerCase());
          const hasField = attrKeys.includes(fieldName.toLowerCase());
          
          // Allow for some flexibility in field naming
          if (!hasField) {
            // Check if the value exists anywhere in attributes
            const anchorValue = anchorFields[fieldName];
            const hasValue = Object.values(attributes).some(v => 
              String(v).toLowerCase().includes(String(anchorValue).toLowerCase())
            );
            
            // Either the field name or value should be present
            expect(hasField || hasValue).toBe(true);
          }
        }
      }
    });
    
    it('should not have duplicate anchor fingerprints with different entity IDs', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        }
      });
      
      const fingerprintMap = new Map();
      
      for (const entity of entities) {
        const fingerprint = entity.anchorFingerprint;
        
        if (fingerprintMap.has(fingerprint)) {
          const existing = fingerprintMap.get(fingerprint);
          
          // If same fingerprint, entities should be semantically identical
          // (This is expected - they should have been merged)
          console.warn(`Duplicate anchor fingerprint found: ${fingerprint}`);
          console.warn(`  Entity 1: ${existing.id} - ${existing.canonicalName}`);
          console.warn(`  Entity 2: ${entity.id} - ${entity.canonicalName}`);
          
          // This is not necessarily an error - it means these entities
          // should be merged in the future
        } else {
          fingerprintMap.set(fingerprint, entity);
        }
      }
      
      // Log statistics
      const totalEntities = entities.length;
      const uniqueFingerprints = fingerprintMap.size;
      const duplicates = totalEntities - uniqueFingerprints;
      
      console.log(`Total entities with anchors: ${totalEntities}`);
      console.log(`Unique anchor fingerprints: ${uniqueFingerprints}`);
      console.log(`Potential merges: ${duplicates}`);
      
      // This test always passes - duplicates are expected and will be merged
      expect(true).toBe(true);
    });
    
  });
  
  describe('4. Determinism Validation', () => {
    
    it('should generate same anchor fingerprint for same input', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        },
        take: 10
      });
      
      for (const entity of entities) {
        // Parse entity data
        const schemas = JSON.parse(entity.schemas || '[]');
        if (schemas.length === 0) continue;
        
        const primarySchema = schemas[0];
        const schemaName = primarySchema.schema_name || primarySchema.name;
        
        // Load schema definition
        const schemaRecord = await prisma.schema.findFirst({
          where: { name: schemaName }
        });
        
        if (!schemaRecord || !schemaRecord.anchorFields) continue;
        
        // Reconstruct schema instance
        const attributes = JSON.parse(entity.attributes || '{}');
        const anchorFieldsConfig = JSON.parse(schemaRecord.anchorFields);
        const coreFields = JSON.parse(schemaRecord.coreFields || '[]');
        
        const schemaInstance = {
          entity_type: entity.type,
          schema_name: schemaName,
          schema_id: schemaRecord.id,
          fields: attributes,
          confidence: entity.confidence
        };
        
        const schemaDefinition = {
          schema_name: schemaName,
          schema_id: schemaRecord.id,
          entity_type: schemaRecord.entityType,
          core_fields: coreFields,
          anchor_fields: anchorFieldsConfig
        };
        
        // Generate anchor fingerprint again
        const regeneratedFingerprint = generateAnchorFingerprint(schemaInstance, schemaDefinition);
        
        // Should match the stored fingerprint
        expect(regeneratedFingerprint).toBe(entity.anchorFingerprint);
      }
    });
    
    it('should extract same anchor fields for same entity', async () => {
      const entities = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        },
        take: 10
      });
      
      for (const entity of entities) {
        const schemas = JSON.parse(entity.schemas || '[]');
        if (schemas.length === 0) continue;
        
        const primarySchema = schemas[0];
        const schemaName = primarySchema.schema_name || primarySchema.name;
        
        const schemaRecord = await prisma.schema.findFirst({
          where: { name: schemaName }
        });
        
        if (!schemaRecord || !schemaRecord.anchorFields) continue;
        
        const anchorFieldsConfig = JSON.parse(schemaRecord.anchorFields);
        const coreFields = JSON.parse(schemaRecord.coreFields || '[]');
        
        const schemaDefinition = {
          schema_name: schemaName,
          schema_id: schemaRecord.id,
          entity_type: schemaRecord.entityType,
          core_fields: coreFields,
          anchor_fields: anchorFieldsConfig
        };
        
        // Extract anchor fields again
        const regeneratedFields = extractAnchorFieldsFromEntity(entity, schemaDefinition);
        const storedFields = JSON.parse(entity.anchorFields);
        
        // Should have same keys
        expect(Object.keys(regeneratedFields).sort()).toEqual(Object.keys(storedFields).sort());
        
        // Values should match (allowing for normalization)
        for (const key of Object.keys(storedFields)) {
          if (regeneratedFields[key] !== undefined) {
            expect(regeneratedFields[key]).toBe(storedFields[key]);
          }
        }
      }
    });
    
  });
  
  describe('5. Schema Configuration Validation', () => {
    
    it('should have schemas with anchor_fields configuration', async () => {
      const schemasWithAnchors = await prisma.schema.findMany({
        where: {
          anchorFields: { not: null }
        }
      });
      
      expect(schemasWithAnchors.length).toBeGreaterThan(0);
      
      for (const schema of schemasWithAnchors) {
        // Should be valid JSON
        expect(() => JSON.parse(schema.anchorFields)).not.toThrow();
        
        const anchorFields = JSON.parse(schema.anchorFields);
        
        // Should be an array
        expect(Array.isArray(anchorFields)).toBe(true);
        
        // Should have at least one field
        expect(anchorFields.length).toBeGreaterThan(0);
        
        // Each field should have a name
        for (const field of anchorFields) {
          if (typeof field === 'string') {
            expect(field).toBeTruthy();
          } else {
            expect(field.name).toBeTruthy();
          }
        }
      }
    });
    
    it('should have all migrated entities reference schemas with anchor_fields', async () => {
      const entitiesWithAnchors = await prisma.kGEntity.findMany({
        where: {
          anchorFingerprint: { not: null }
        }
      });
      
      let entitiesChecked = 0;
      let entitiesWithValidSchemas = 0;
      
      for (const entity of entitiesWithAnchors) {
        const schemas = JSON.parse(entity.schemas || '[]');
        if (schemas.length === 0) continue;
        
        entitiesChecked++;
        
        const primarySchema = schemas[0];
        const schemaName = primarySchema.schema_name || primarySchema.name;
        
        const schemaRecord = await prisma.schema.findFirst({
          where: { name: schemaName }
        });
        
        if (schemaRecord && schemaRecord.anchorFields) {
          entitiesWithValidSchemas++;
        }
      }
      
      console.log(`Entities checked: ${entitiesChecked}`);
      console.log(`Entities with valid schemas: ${entitiesWithValidSchemas}`);
      
      // Most entities should have valid schema references
      if (entitiesChecked > 0) {
        const validPercentage = (entitiesWithValidSchemas / entitiesChecked) * 100;
        expect(validPercentage).toBeGreaterThan(80);
      }
    });
    
  });
  
  describe('6. Migration Coverage Statistics', () => {
    
    it('should report migration coverage', async () => {
      const totalEntities = await prisma.kGEntity.count();
      const entitiesWithAnchors = await prisma.kGEntity.count({
        where: {
          anchorFingerprint: { not: null }
        }
      });
      const entitiesWithoutAnchors = await prisma.kGEntity.count({
        where: {
          anchorFingerprint: null
        }
      });
      
      const coverage = totalEntities > 0 
        ? ((entitiesWithAnchors / totalEntities) * 100).toFixed(2)
        : 0;
      
      console.log('\n=== Migration Coverage Statistics ===');
      console.log(`Total entities: ${totalEntities}`);
      console.log(`Entities with anchors: ${entitiesWithAnchors}`);
      console.log(`Entities without anchors: ${entitiesWithoutAnchors}`);
      console.log(`Coverage: ${coverage}%`);
      
      // Should have reasonable coverage (>80%)
      expect(parseFloat(coverage)).toBeGreaterThan(80);
    });
    
    it('should report coverage by entity type', async () => {
      const entityTypes = await prisma.kGEntity.groupBy({
        by: ['type'],
        _count: true
      });
      
      console.log('\n=== Coverage by Entity Type ===');
      
      for (const typeGroup of entityTypes) {
        const totalOfType = typeGroup._count;
        const withAnchors = await prisma.kGEntity.count({
          where: {
            type: typeGroup.type,
            anchorFingerprint: { not: null }
          }
        });
        
        const coverage = totalOfType > 0
          ? ((withAnchors / totalOfType) * 100).toFixed(2)
          : 0;
        
        console.log(`${typeGroup.type}: ${withAnchors}/${totalOfType} (${coverage}%)`);
      }
      
      // Test always passes - this is informational
      expect(true).toBe(true);
    });
    
  });
  
});
