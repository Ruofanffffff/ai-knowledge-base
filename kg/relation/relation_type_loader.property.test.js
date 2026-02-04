/**
 * Property-Based Tests for RelationTypeLoader
 * 
 * Uses fast-check to verify universal properties of the loader.
 * 
 * Feature: relation-type-expansion
 * Property 12: 配置文件加载幂等性
 * **Validates: Requirements 11.2**
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const RelationTypeLoader = require('./relation_type_loader');
const { VALID_DOMAINS } = require('./relation_type_definition');

/**
 * Arbitrary generator for valid relation type definitions
 */
function relationTypeArbitrary() {
  return fc.record({
    relationTypeId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => /^[a-z_]+$/.test(s)),
    name: fc.string({ minLength: 3, maxLength: 30 }),
    displayName: fc.string({ minLength: 2, maxLength: 20 }),
    description: fc.string({ minLength: 10, maxLength: 200 }),
    domain: fc.constantFrom(...VALID_DOMAINS),
    category: fc.string({ minLength: 3, maxLength: 20 }),
    sourceEntityTypes: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
    targetEntityTypes: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
    isDirectional: fc.boolean(),
    isTemporal: fc.boolean(),
    supportsConfidence: fc.boolean(),
    version: fc.constant('1.0.0'),
    active: fc.boolean()
  });
}

/**
 * Arbitrary generator for an array of unique relation types
 */
function uniqueRelationTypesArbitrary() {
  return fc.array(relationTypeArbitrary(), { minLength: 1, maxLength: 10 })
    .map(types => {
      const seen = new Set();
      return types.filter(type => {
        if (seen.has(type.relationTypeId)) {
          return false;
        }
        seen.add(type.relationTypeId);
        return true;
      });
    })
    .filter(types => types.length > 0);
}

/**
 * Helper to create a temporary JSON file
 */
function createTempFile(data) {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `relation_types_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
  return tempFile;
}

/**
 * Helper to clean up temporary file
 */
function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('RelationTypeLoader Property Tests', () => {
  /**
   * Property 12: 配置文件加载幂等性
   * For any relation type definition file, loading the same file multiple times
   * should produce the same relation type registry state
   * 
   * **Validates: Requirements 11.2**
   */
  describe('Property 12: Configuration File Loading Idempotence', () => {
    it('should produce identical results when loading the same file multiple times', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          (relationTypes) => {
            const loader = new RelationTypeLoader();
            let tempFile = null;
            
            try {
              // Create temp file with relation types
              tempFile = createTempFile({ types: relationTypes });
              
              // Load file multiple times
              const result1 = loader.loadFromFile(tempFile);
              const result2 = loader.loadFromFile(tempFile);
              const result3 = loader.loadFromFile(tempFile);
              
              // Results should have same length
              expect(result1.length).toBe(result2.length);
              expect(result2.length).toBe(result3.length);
              expect(result1.length).toBe(relationTypes.length);
              
              // Results should have same IDs in same order
              const ids1 = result1.map(t => t.relationTypeId);
              const ids2 = result2.map(t => t.relationTypeId);
              const ids3 = result3.map(t => t.relationTypeId);
              
              expect(ids1).toEqual(ids2);
              expect(ids2).toEqual(ids3);
              
              // Results should have same content
              for (let i = 0; i < result1.length; i++) {
                expect(result1[i].relationTypeId).toBe(result2[i].relationTypeId);
                expect(result1[i].name).toBe(result2[i].name);
                expect(result1[i].displayName).toBe(result2[i].displayName);
                expect(result1[i].domain).toBe(result2[i].domain);
                expect(result1[i].category).toBe(result2[i].category);
                
                expect(result2[i].relationTypeId).toBe(result3[i].relationTypeId);
                expect(result2[i].name).toBe(result3[i].name);
                expect(result2[i].displayName).toBe(result3[i].displayName);
              }
              
              return true;
            } finally {
              if (tempFile) {
                cleanupTempFile(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce identical results when loading from array multiple times', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          (relationTypes) => {
            const loader = new RelationTypeLoader();
            
            // Load from array multiple times
            const result1 = loader.loadFromArray(relationTypes);
            const result2 = loader.loadFromArray(relationTypes);
            const result3 = loader.loadFromArray(relationTypes);
            
            // Results should have same length
            expect(result1.length).toBe(result2.length);
            expect(result2.length).toBe(result3.length);
            
            // Results should have same IDs
            const ids1 = result1.map(t => t.relationTypeId).sort();
            const ids2 = result2.map(t => t.relationTypeId).sort();
            const ids3 = result3.map(t => t.relationTypeId).sort();
            
            expect(ids1).toEqual(ids2);
            expect(ids2).toEqual(ids3);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce same results regardless of loader instance', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          (relationTypes) => {
            let tempFile = null;
            
            try {
              // Create temp file
              tempFile = createTempFile({ types: relationTypes });
              
              // Load with different loader instances
              const loader1 = new RelationTypeLoader();
              const loader2 = new RelationTypeLoader();
              const loader3 = new RelationTypeLoader();
              
              const result1 = loader1.loadFromFile(tempFile);
              const result2 = loader2.loadFromFile(tempFile);
              const result3 = loader3.loadFromFile(tempFile);
              
              // Results should be identical
              expect(result1.length).toBe(result2.length);
              expect(result2.length).toBe(result3.length);
              
              const ids1 = result1.map(t => t.relationTypeId).sort();
              const ids2 = result2.map(t => t.relationTypeId).sort();
              const ids3 = result3.map(t => t.relationTypeId).sort();
              
              expect(ids1).toEqual(ids2);
              expect(ids2).toEqual(ids3);
              
              return true;
            } finally {
              if (tempFile) {
                cleanupTempFile(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle hierarchical JSON structure idempotently', async () => {
      await fc.assert(
        fc.asyncProperty(
          uniqueRelationTypesArbitrary(),
          async (relationTypes) => {
            const loader = new RelationTypeLoader();
            let tempFile = null;
            
            try {
              // Create hierarchical structure using Map to avoid prototype pollution
              const hierarchical = {
                version: '1.0.0',
                domains: {}
              };
              
              // Group by domain and category
              for (const type of relationTypes) {
                const domain = type.domain;
                const category = type.category;
                
                if (!Object.prototype.hasOwnProperty.call(hierarchical.domains, domain)) {
                  hierarchical.domains[domain] = {
                    displayName: domain,
                    categories: {}
                  };
                }
                
                if (!Object.prototype.hasOwnProperty.call(hierarchical.domains[domain].categories, category)) {
                  hierarchical.domains[domain].categories[category] = {
                    displayName: category,
                    types: []
                  };
                }
                
                hierarchical.domains[domain].categories[category].types.push(type);
              }
              
              // Create temp file
              tempFile = createTempFile(hierarchical);
              
              // Load multiple times
              const result1 = await loader.loadFromFile(tempFile);
              const result2 = await loader.loadFromFile(tempFile);
              
              // Should produce same results
              expect(result1.length).toBe(result2.length);
              expect(result1.length).toBe(relationTypes.length);
              
              const ids1 = result1.map(t => t.relationTypeId).sort();
              const ids2 = result2.map(t => t.relationTypeId).sort();
              
              expect(ids1).toEqual(ids2);
              
              return true;
            } finally {
              if (tempFile) {
                cleanupTempFile(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Normalization is consistent
   */
  describe('Property: Normalization Consistency', () => {
    it('should produce consistent normalized output', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const loader = new RelationTypeLoader();
            
            // Normalize multiple times
            const normalized1 = loader.normalize(relationType);
            const normalized2 = loader.normalize(relationType);
            const normalized3 = loader.normalize(relationType);
            
            // Should be identical
            expect(normalized1.relationTypeId).toBe(normalized2.relationTypeId);
            expect(normalized2.relationTypeId).toBe(normalized3.relationTypeId);
            
            expect(normalized1.name).toBe(normalized2.name);
            expect(normalized2.name).toBe(normalized3.name);
            
            expect(normalized1.domain).toBe(normalized2.domain);
            expect(normalized2.domain).toBe(normalized3.domain);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Array loading preserves count
   */
  describe('Property: Array Loading Preserves Count', () => {
    it('should preserve the number of valid relation types', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          (relationTypes) => {
            const loader = new RelationTypeLoader();
            
            const result = loader.loadFromArray(relationTypes);
            
            // Should have same number of types
            expect(result.length).toBe(relationTypes.length);
            
            // All original IDs should be present
            const originalIds = new Set(relationTypes.map(t => t.relationTypeId));
            const resultIds = new Set(result.map(t => t.relationTypeId));
            
            expect(resultIds.size).toBe(originalIds.size);
            for (const id of originalIds) {
              expect(resultIds.has(id)).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: File validation is consistent
   */
  describe('Property: File Validation Consistency', () => {
    it('should produce consistent validation results', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          (relationTypes) => {
            const loader = new RelationTypeLoader();
            let tempFile = null;
            
            try {
              tempFile = createTempFile({ types: relationTypes });
              
              // Validate multiple times
              const validation1 = loader.validateFile(tempFile);
              const validation2 = loader.validateFile(tempFile);
              const validation3 = loader.validateFile(tempFile);
              
              // Results should be identical
              expect(validation1.valid).toBe(validation2.valid);
              expect(validation2.valid).toBe(validation3.valid);
              
              expect(validation1.count).toBe(validation2.count);
              expect(validation2.count).toBe(validation3.count);
              
              expect(validation1.errors.length).toBe(validation2.errors.length);
              expect(validation2.errors.length).toBe(validation3.errors.length);
              
              return true;
            } finally {
              if (tempFile) {
                cleanupTempFile(tempFile);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
