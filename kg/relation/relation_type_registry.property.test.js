/**
 * Property-Based Tests for RelationTypeRegistry
 * 
 * Uses fast-check to verify universal properties of the registry.
 * 
 * Feature: relation-type-expansion
 * Requirements: 7.1, 9.2, 9.3
 */

const fc = require('fast-check');
const RelationTypeRegistry = require('./relation_type_registry');
const { VALID_DOMAINS } = require('./relation_type_definition');

/**
 * Arbitrary generator for valid relation type definitions
 */
function relationTypeArbitrary() {
  // Filter to avoid problematic property names like __proto__, constructor, etc.
  const safeStringArbitrary = () => fc.string({ minLength: 3, maxLength: 20 })
    .filter(s => !['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'].includes(s));
  
  return fc.record({
    relationTypeId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => /^[a-z_]+$/.test(s)),
    name: fc.string({ minLength: 3, maxLength: 30 }),
    displayName: fc.string({ minLength: 2, maxLength: 20 }),
    description: fc.string({ minLength: 10, maxLength: 200 }),
    domain: fc.constantFrom(...VALID_DOMAINS),
    category: fc.string({ minLength: 3, maxLength: 20 }),
    sourceEntityTypes: fc.array(safeStringArbitrary(), { minLength: 1, maxLength: 5 }),
    targetEntityTypes: fc.array(safeStringArbitrary(), { minLength: 1, maxLength: 5 }),
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
  return fc.array(relationTypeArbitrary(), { minLength: 1, maxLength: 20 })
    .map(types => {
      // Ensure unique relationTypeIds
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

describe('RelationTypeRegistry Property Tests', () => {
  /**
   * Property 2: 关系类型ID唯一性
   * For any two different relation type definitions, their relationTypeId must be different
   * 
   * **Validates: Requirements 7.1**
   */
  describe('Property 2: Relation Type ID Uniqueness', () => {
    it('should enforce unique relationTypeIds in the registry', () => {
      fc.assert(
        fc.property(
          relationTypeArbitrary(),
          (relationType) => {
            const registry = new RelationTypeRegistry();
            
            // Register the first time - should succeed
            registry.register(relationType);
            expect(registry.has(relationType.relationTypeId)).toBe(true);
            
            // Try to register again with same ID - should fail
            expect(() => registry.register(relationType)).toThrow('already exists');
            
            // Registry should still have exactly one entry
            expect(registry.count()).toBe(1);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow different relation types with different IDs', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          (relationTypes) => {
            const registry = new RelationTypeRegistry();
            
            // Register all types
            for (const type of relationTypes) {
              registry.register(type);
            }
            
            // All types should be registered
            expect(registry.count()).toBe(relationTypes.length);
            
            // Each type should be retrievable
            for (const type of relationTypes) {
              expect(registry.has(type.relationTypeId)).toBe(true);
              const retrieved = registry.get(type.relationTypeId);
              expect(retrieved).not.toBeNull();
              expect(retrieved.relationTypeId).toBe(type.relationTypeId);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain uniqueness across batch registrations', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          fc.nat({ max: 10 }),
          (relationTypes, duplicateIndex) => {
            const registry = new RelationTypeRegistry();
            
            // Register all types
            const result1 = registry.registerBatch(relationTypes);
            expect(result1.successful).toBe(relationTypes.length);
            
            // Try to register again - should fail for all
            const result2 = registry.registerBatch(relationTypes);
            expect(result2.successful).toBe(0);
            expect(result2.failed).toBe(relationTypes.length);
            
            // Count should remain the same
            expect(registry.count()).toBe(relationTypes.length);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: 动态注册不影响现有数据
   * For any registry initial state and new relation type,
   * registering a new type should not affect previously registered types
   * 
   * **Validates: Requirements 9.2, 9.3**
   */
  describe('Property 9: Dynamic Registration Does Not Affect Existing Data', () => {
    it('should preserve existing types when registering new ones', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          relationTypeArbitrary(),
          (initialTypes, newType) => {
            const registry = new RelationTypeRegistry();
            
            // Register initial types
            registry.registerBatch(initialTypes);
            const initialCount = registry.count();
            
            // Store initial state
            const initialIds = initialTypes.map(t => t.relationTypeId);
            const initialData = initialIds.map(id => ({
              id,
              data: registry.get(id)
            }));
            
            // Ensure new type has unique ID
            if (registry.has(newType.relationTypeId)) {
              newType.relationTypeId = newType.relationTypeId + '_unique';
            }
            
            // Register new type
            registry.register(newType);
            
            // Verify count increased by 1
            expect(registry.count()).toBe(initialCount + 1);
            
            // Verify all initial types are still present and unchanged
            for (const { id, data } of initialData) {
              expect(registry.has(id)).toBe(true);
              const current = registry.get(id);
              expect(current).not.toBeNull();
              expect(current.relationTypeId).toBe(data.relationTypeId);
              expect(current.name).toBe(data.name);
              expect(current.displayName).toBe(data.displayName);
              expect(current.domain).toBe(data.domain);
              expect(current.category).toBe(data.category);
            }
            
            // Verify new type is also present
            expect(registry.has(newType.relationTypeId)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve domain indexes when adding new types', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          relationTypeArbitrary(),
          (initialTypes, newType) => {
            const registry = new RelationTypeRegistry();
            
            // Register initial types
            registry.registerBatch(initialTypes);
            
            // Count types by domain before
            const domainCountsBefore = {};
            for (const domain of VALID_DOMAINS) {
              domainCountsBefore[domain] = registry.getByDomain(domain).length;
            }
            
            // Ensure new type has unique ID
            if (registry.has(newType.relationTypeId)) {
              newType.relationTypeId = newType.relationTypeId + '_unique';
            }
            
            // Register new type
            registry.register(newType);
            
            // Count types by domain after
            const domainCountsAfter = {};
            for (const domain of VALID_DOMAINS) {
              domainCountsAfter[domain] = registry.getByDomain(domain).length;
            }
            
            // Verify counts: only the new type's domain should increase by 1
            for (const domain of VALID_DOMAINS) {
              if (domain === newType.domain) {
                expect(domainCountsAfter[domain]).toBe(domainCountsBefore[domain] + 1);
              } else {
                expect(domainCountsAfter[domain]).toBe(domainCountsBefore[domain]);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve category indexes when adding new types', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          relationTypeArbitrary(),
          (initialTypes, newType) => {
            const registry = new RelationTypeRegistry();
            
            // Register initial types
            registry.registerBatch(initialTypes);
            
            // Get all categories before
            const categoriesBefore = new Set(initialTypes.map(t => t.category));
            const categoryCountsBefore = {};
            for (const category of categoriesBefore) {
              categoryCountsBefore[category] = registry.getByCategory(category).length;
            }
            
            // Ensure new type has unique ID
            if (registry.has(newType.relationTypeId)) {
              newType.relationTypeId = newType.relationTypeId + '_unique';
            }
            
            // Register new type
            registry.register(newType);
            
            // Verify existing category counts unchanged
            for (const category of categoriesBefore) {
              const currentCount = registry.getByCategory(category).length;
              if (category === newType.category) {
                expect(currentCount).toBe(categoryCountsBefore[category] + 1);
              } else {
                expect(currentCount).toBe(categoryCountsBefore[category]);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve entity type indexes when adding new types', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          relationTypeArbitrary(),
          (initialTypes, newType) => {
            const registry = new RelationTypeRegistry();
            
            // Register initial types
            registry.registerBatch(initialTypes);
            
            // Get all entity types before
            const entityTypesBefore = new Set();
            for (const type of initialTypes) {
              type.sourceEntityTypes.forEach(et => entityTypesBefore.add(et));
              type.targetEntityTypes.forEach(et => entityTypesBefore.add(et));
            }
            
            const entityCountsBefore = {};
            for (const entityType of entityTypesBefore) {
              entityCountsBefore[entityType] = registry.getByEntityType(entityType).length;
            }
            
            // Ensure new type has unique ID
            if (registry.has(newType.relationTypeId)) {
              newType.relationTypeId = newType.relationTypeId + '_unique';
            }
            
            // Register new type
            registry.register(newType);
            
            // Verify existing entity type counts
            const newEntityTypes = new Set([
              ...newType.sourceEntityTypes,
              ...newType.targetEntityTypes
            ]);
            
            for (const entityType of entityTypesBefore) {
              const currentCount = registry.getByEntityType(entityType).length;
              if (newEntityTypes.has(entityType)) {
                expect(currentCount).toBeGreaterThanOrEqual(entityCountsBefore[entityType]);
              } else {
                expect(currentCount).toBe(entityCountsBefore[entityType]);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain registry consistency after multiple registrations', () => {
      fc.assert(
        fc.property(
          fc.array(uniqueRelationTypesArbitrary(), { minLength: 2, maxLength: 5 }),
          (batches) => {
            const registry = new RelationTypeRegistry();
            let totalExpected = 0;
            const allIds = new Set();
            
            // Register batches sequentially
            for (const batch of batches) {
              // Ensure unique IDs across batches
              const uniqueBatch = batch.filter(type => {
                if (allIds.has(type.relationTypeId)) {
                  return false;
                }
                allIds.add(type.relationTypeId);
                return true;
              });
              
              if (uniqueBatch.length > 0) {
                registry.registerBatch(uniqueBatch);
                totalExpected += uniqueBatch.length;
              }
            }
            
            // Verify total count
            expect(registry.count()).toBe(totalExpected);
            
            // Verify all IDs are present
            for (const id of allIds) {
              expect(registry.has(id)).toBe(true);
            }
            
            // Verify stats consistency
            const stats = registry.getStats();
            expect(stats.total).toBe(totalExpected);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Registry operations are idempotent for queries
   */
  describe('Property: Query Idempotence', () => {
    it('should return consistent results for repeated queries', () => {
      fc.assert(
        fc.property(
          uniqueRelationTypesArbitrary(),
          fc.constantFrom(...VALID_DOMAINS),
          (relationTypes, domain) => {
            const registry = new RelationTypeRegistry();
            registry.registerBatch(relationTypes);
            
            // Query multiple times
            const result1 = registry.getByDomain(domain);
            const result2 = registry.getByDomain(domain);
            const result3 = registry.getByDomain(domain);
            
            // Results should be identical
            expect(result1.length).toBe(result2.length);
            expect(result2.length).toBe(result3.length);
            
            // IDs should match
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
  });
});
