/**
 * Validation Tests for Relation Types JSON
 * 
 * Validates the completeness and correctness of the relation_types.json file.
 * 
 * Feature: relation-type-expansion
 * Property 1: 关系类型元数据完整性
 * Property 3: 领域分类一致性
 * **Validates: Requirements 7.1-7.10, 8.1**
 */

const fc = require('fast-check');
const RelationTypeLoader = require('./relation_type_loader');
const { VALID_DOMAINS, hasRequiredMetadata } = require('./relation_type_definition');
const path = require('path');

describe('Relation Types JSON Validation', () => {
  let loader;
  let relationTypes;

  beforeAll(() => {
    loader = new RelationTypeLoader();
    const filePath = path.join(__dirname, 'relation_types.json');
    relationTypes = loader.loadFromFile(filePath);
  });

  describe('File Structure', () => {
    it('should load relation types from the JSON file', () => {
      expect(relationTypes).toBeDefined();
      expect(Array.isArray(relationTypes)).toBe(true);
      expect(relationTypes.length).toBeGreaterThan(0);
    });

    it('should have exactly 90 relation types', () => {
      expect(relationTypes.length).toBe(90);
    });
  });

  describe('Domain Distribution', () => {
    it('should have relation types in all 6 domains', () => {
      const domains = new Set(relationTypes.map(t => t.domain));
      expect(domains.size).toBe(6);
      
      for (const domain of VALID_DOMAINS) {
        expect(domains.has(domain)).toBe(true);
      }
    });

    it('should have at least 6 types in life domain', () => {
      const lifeTypes = relationTypes.filter(t => t.domain === 'life');
      expect(lifeTypes.length).toBeGreaterThanOrEqual(6);
    });

    it('should have at least 6 types in work domain', () => {
      const workTypes = relationTypes.filter(t => t.domain === 'work');
      expect(workTypes.length).toBeGreaterThanOrEqual(6);
    });

    it('should have at least 6 types in travel domain', () => {
      const travelTypes = relationTypes.filter(t => t.domain === 'travel');
      expect(travelTypes.length).toBeGreaterThanOrEqual(6);
    });

    it('should have at least 7 types in shopping domain', () => {
      const shoppingTypes = relationTypes.filter(t => t.domain === 'shopping');
      expect(shoppingTypes.length).toBeGreaterThanOrEqual(7);
    });

    it('should have at least 7 types in government domain', () => {
      const govTypes = relationTypes.filter(t => t.domain === 'government');
      expect(govTypes.length).toBeGreaterThanOrEqual(7);
    });

    it('should have at least 6 types in management domain', () => {
      const mgmtTypes = relationTypes.filter(t => t.domain === 'management');
      expect(mgmtTypes.length).toBeGreaterThanOrEqual(6);
    });
  });

  /**
   * Property 1: 关系类型元数据完整性
   * For any relation type definition, it must have all required metadata fields
   * **Validates: Requirements 7.1-7.10**
   */
  describe('Property 1: Relation Type Metadata Completeness', () => {
    it('should have all required metadata fields for every relation type', () => {
      for (const relationType of relationTypes) {
        expect(hasRequiredMetadata(relationType)).toBe(true);
        
        // Verify specific fields
        expect(relationType.relationTypeId).toBeDefined();
        expect(typeof relationType.relationTypeId).toBe('string');
        expect(relationType.relationTypeId.length).toBeGreaterThan(0);
        
        expect(relationType.name).toBeDefined();
        expect(typeof relationType.name).toBe('string');
        
        expect(relationType.displayName).toBeDefined();
        expect(typeof relationType.displayName).toBe('string');
        
        expect(relationType.description).toBeDefined();
        expect(typeof relationType.description).toBe('string');
        
        expect(relationType.domain).toBeDefined();
        expect(typeof relationType.domain).toBe('string');
        
        expect(relationType.sourceEntityTypes).toBeDefined();
        expect(Array.isArray(relationType.sourceEntityTypes)).toBe(true);
        expect(relationType.sourceEntityTypes.length).toBeGreaterThan(0);
        
        expect(relationType.targetEntityTypes).toBeDefined();
        expect(Array.isArray(relationType.targetEntityTypes)).toBe(true);
        expect(relationType.targetEntityTypes.length).toBeGreaterThan(0);
        
        expect(relationType.isDirectional).toBeDefined();
        expect(typeof relationType.isDirectional).toBe('boolean');
        
        expect(relationType.isTemporal).toBeDefined();
        expect(typeof relationType.isTemporal).toBe('boolean');
        
        expect(relationType.supportsConfidence).toBeDefined();
        expect(typeof relationType.supportsConfidence).toBe('boolean');
      }
    });

    it('should have unique relationTypeIds', () => {
      const ids = relationTypes.map(t => t.relationTypeId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have non-empty descriptions', () => {
      for (const relationType of relationTypes) {
        expect(relationType.description.length).toBeGreaterThan(0);
      }
    });
  });

  /**
   * Property 3: 领域分类一致性
   * For any relation type definition, its domain field must be one of the valid domains
   * **Validates: Requirements 8.1**
   */
  describe('Property 3: Domain Classification Consistency', () => {
    it('should have valid domain values for all relation types', () => {
      for (const relationType of relationTypes) {
        expect(VALID_DOMAINS).toContain(relationType.domain);
      }
    });

    it('should have consistent domain naming', () => {
      const domains = relationTypes.map(t => t.domain);
      for (const domain of domains) {
        expect(domain).toMatch(/^[a-z]+$/); // lowercase only
      }
    });
  });

  describe('Category Structure', () => {
    it('should have categories for each domain', () => {
      const domainCategories = {};
      
      for (const relationType of relationTypes) {
        if (!domainCategories[relationType.domain]) {
          domainCategories[relationType.domain] = new Set();
        }
        domainCategories[relationType.domain].add(relationType.category);
      }
      
      // Each domain should have at least 2 categories
      for (const domain of VALID_DOMAINS) {
        expect(domainCategories[domain].size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Entity Type Constraints', () => {
    it('should have valid entity type names', () => {
      const validEntityTypes = [
        'PersonEntity',
        'OrganizationEntity',
        'LocationEntity',
        'EventEntity',
        'IndicatorEntity',
        'ProductEntity',
        'ProjectEntity',
        'DocumentEntity',
        'EquipmentEntity',
        'ResourceEntity'
      ];
      
      for (const relationType of relationTypes) {
        for (const entityType of relationType.sourceEntityTypes) {
          expect(validEntityTypes).toContain(entityType);
        }
        for (const entityType of relationType.targetEntityTypes) {
          expect(validEntityTypes).toContain(entityType);
        }
      }
    });

    it('should have at least one source entity type', () => {
      for (const relationType of relationTypes) {
        expect(relationType.sourceEntityTypes.length).toBeGreaterThan(0);
      }
    });

    it('should have at least one target entity type', () => {
      for (const relationType of relationTypes) {
        expect(relationType.targetEntityTypes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Naming Conventions', () => {
    it('should follow naming convention for relationTypeId', () => {
      for (const relationType of relationTypes) {
        // Should be domain_category or domain_name format
        expect(relationType.relationTypeId).toMatch(/^[a-z_]+$/);
        expect(relationType.relationTypeId.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('should have English names', () => {
      for (const relationType of relationTypes) {
        expect(relationType.name).toMatch(/^[a-z_]+$/);
      }
    });

    it('should have Chinese display names', () => {
      for (const relationType of relationTypes) {
        // Should contain at least one Chinese character
        expect(relationType.displayName).toMatch(/[\u4e00-\u9fa5]/);
      }
    });
  });

  describe('Specific Domain Requirements', () => {
    describe('Life Domain', () => {
      it('should have family relations', () => {
        const familyTypes = relationTypes.filter(t => 
          t.domain === 'life' && t.category === 'family'
        );
        expect(familyTypes.length).toBeGreaterThanOrEqual(4);
      });

      it('should have social relations', () => {
        const socialTypes = relationTypes.filter(t => 
          t.domain === 'life' && t.category === 'social'
        );
        expect(socialTypes.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Work Domain', () => {
      it('should have employment relations', () => {
        const employmentTypes = relationTypes.filter(t => 
          t.domain === 'work' && t.category === 'employment'
        );
        expect(employmentTypes.length).toBeGreaterThanOrEqual(3);
      });

      it('should have project relations', () => {
        const projectTypes = relationTypes.filter(t => 
          t.domain === 'work' && t.category === 'project'
        );
        expect(projectTypes.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Travel Domain', () => {
      it('should have transportation relations', () => {
        const transportTypes = relationTypes.filter(t => 
          t.domain === 'travel' && t.category === 'transportation'
        );
        expect(transportTypes.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Shopping Domain', () => {
      it('should have purchase relations', () => {
        const purchaseTypes = relationTypes.filter(t => 
          t.domain === 'shopping' && t.category === 'purchase'
        );
        expect(purchaseTypes.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Government Domain', () => {
      it('should have approval relations', () => {
        const approvalTypes = relationTypes.filter(t => 
          t.domain === 'government' && t.category === 'approval'
        );
        expect(approvalTypes.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Management Domain', () => {
      it('should have decision relations', () => {
        const decisionTypes = relationTypes.filter(t => 
          t.domain === 'management' && t.category === 'decision'
        );
        expect(decisionTypes.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Temporal and Directional Properties', () => {
    it('should have mix of directional and bidirectional relations', () => {
      const directional = relationTypes.filter(t => t.isDirectional);
      const bidirectional = relationTypes.filter(t => !t.isDirectional);
      
      expect(directional.length).toBeGreaterThan(0);
      expect(bidirectional.length).toBeGreaterThan(0);
    });

    it('should have mix of temporal and non-temporal relations', () => {
      const temporal = relationTypes.filter(t => t.isTemporal);
      const nonTemporal = relationTypes.filter(t => !t.isTemporal);
      
      expect(temporal.length).toBeGreaterThan(0);
      expect(nonTemporal.length).toBeGreaterThan(0);
    });

    it('should support confidence for all relations', () => {
      for (const relationType of relationTypes) {
        expect(relationType.supportsConfidence).toBe(true);
      }
    });
  });
});
