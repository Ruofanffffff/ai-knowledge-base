/**
 * Unit Tests for RelationTypeLoader
 * 
 * Tests JSON file loading, inheritance resolution, and error handling.
 * 
 * Requirements: 11.1, 11.2
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const RelationTypeLoader = require('./relation_type_loader');
const { createRelationTypeDefinition } = require('./relation_type_definition');

/**
 * Helper to create a temporary JSON file
 */
function createTempFile(data) {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `relation_types_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`);
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

describe('RelationTypeLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new RelationTypeLoader();
  });

  describe('loadFromFile', () => {
    it('should load relation types from a flat JSON array', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const tempFile = createTempFile(types);

      try {
        const loaded = loader.loadFromFile(tempFile);
        expect(loaded).toHaveLength(1);
        expect(loaded[0].relationTypeId).toBe('family_parent');
      } finally {
        cleanupTempFile(tempFile);
      }
    });

    it('should load relation types from hierarchical JSON structure', () => {
      const data = {
        version: '1.0.0',
        domains: {
          life: {
            displayName: '生活领域',
            categories: {
              family: {
                displayName: '家庭关系',
                types: [
                  {
                    relationTypeId: 'family_parent',
                    name: 'parent',
                    displayName: '父母',
                    description: '表示父母关系',
                    sourceEntityTypes: ['PersonEntity'],
                    targetEntityTypes: ['PersonEntity'],
                    isDirectional: true,
                    isTemporal: false,
                    supportsConfidence: true
                  }
                ]
              }
            }
          }
        }
      };

      const tempFile = createTempFile(data);

      try {
        const loaded = loader.loadFromFile(tempFile);
        expect(loaded).toHaveLength(1);
        expect(loaded[0].relationTypeId).toBe('family_parent');
        expect(loaded[0].domain).toBe('life');
        expect(loaded[0].category).toBe('family');
      } finally {
        cleanupTempFile(tempFile);
      }
    });

    it('should throw error for non-existent file', () => {
      expect(() => {
        loader.loadFromFile('/non/existent/file.json');
      }).toThrow();
    });

    it('should throw error for invalid JSON', () => {
      const tempFile = path.join(os.tmpdir(), `invalid_${Date.now()}.json`);
      fs.writeFileSync(tempFile, 'invalid json content', 'utf8');

      try {
        expect(() => {
          loader.loadFromFile(tempFile);
        }).toThrow();
      } finally {
        cleanupTempFile(tempFile);
      }
    });

    it('should track loaded files', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const tempFile = createTempFile(types);

      try {
        loader.loadFromFile(tempFile);
        const loadedFiles = loader.getLoadedFiles();
        expect(loadedFiles.length).toBeGreaterThan(0);
        expect(loadedFiles.some(f => f.includes('relation_types_test_'))).toBe(true);
      } finally {
        cleanupTempFile(tempFile);
      }
    });
  });

  describe('loadFromArray', () => {
    it('should load relation types from an array', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }),
        createRelationTypeDefinition({
          relationTypeId: 'family_child',
          name: 'child',
          displayName: '子女',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const loaded = loader.loadFromArray(types);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].relationTypeId).toBe('family_parent');
      expect(loaded[1].relationTypeId).toBe('family_child');
    });

    it('should throw error for non-array input', () => {
      expect(() => {
        loader.loadFromArray('not an array');
      }).toThrow('must be an array');
    });

    it('should throw error for invalid relation type in array', () => {
      const types = [
        {
          relationTypeId: 'invalid'
          // Missing required fields
        }
      ];

      expect(() => {
        loader.loadFromArray(types);
      }).toThrow();
    });
  });

  describe('normalize', () => {
    it('should normalize a valid relation type', () => {
      const type = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity']
      };

      const normalized = loader.normalize(type);
      expect(normalized.relationTypeId).toBe('family_parent');
      expect(normalized.isDirectional).toBe(true); // Default value
      expect(normalized.version).toBe('1.0.0'); // Default value
    });

    it('should throw error for invalid relation type', () => {
      const type = {
        relationTypeId: 'invalid'
        // Missing required fields
      };

      expect(() => {
        loader.normalize(type);
      }).toThrow('Invalid relation type definition');
    });
  });

  describe('resolveInheritance', () => {
    it('should resolve parent-child inheritance', () => {
      const parent = createRelationTypeDefinition({
        relationTypeId: 'base_relation',
        name: 'base',
        displayName: '基础关系',
        description: '基础关系描述',
        domain: 'life',
        category: 'base',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      });

      const child = createRelationTypeDefinition({
        relationTypeId: 'child_relation',
        name: 'child',
        displayName: '子关系',
        description: '子关系描述',
        domain: 'life',
        category: 'child',
        sourceEntityTypes: ['EntityC'],
        targetEntityTypes: ['EntityD'],
        parentType: 'base_relation'
      });

      const resolved = loader.resolveInheritance([parent, child]);
      
      expect(resolved).toHaveLength(2);
      
      const resolvedChild = resolved.find(t => t.relationTypeId === 'child_relation');
      expect(resolvedChild).toBeDefined();
      expect(resolvedChild.parentType).toBe('base_relation');
      // Child should override parent's entity types
      expect(resolvedChild.sourceEntityTypes).toEqual(['EntityC']);
      expect(resolvedChild.targetEntityTypes).toEqual(['EntityD']);
    });

    it('should handle missing parent gracefully', () => {
      const child = createRelationTypeDefinition({
        relationTypeId: 'child_relation',
        name: 'child',
        displayName: '子关系',
        domain: 'life',
        category: 'child',
        sourceEntityTypes: ['EntityC'],
        targetEntityTypes: ['EntityD'],
        parentType: 'non_existent_parent'
      });

      // Should not throw, just log warning
      const resolved = loader.resolveInheritance([child]);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].relationTypeId).toBe('child_relation');
    });

    it('should handle types without parents', () => {
      const type = createRelationTypeDefinition({
        relationTypeId: 'standalone_relation',
        name: 'standalone',
        displayName: '独立关系',
        domain: 'life',
        category: 'standalone',
        sourceEntityTypes: ['EntityA'],
        targetEntityTypes: ['EntityB']
      });

      const resolved = loader.resolveInheritance([type]);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].relationTypeId).toBe('standalone_relation');
    });
  });

  describe('loadFromFiles', () => {
    it('should load from multiple files', () => {
      const file1Data = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const file2Data = [
        createRelationTypeDefinition({
          relationTypeId: 'work_employ',
          name: 'employ',
          displayName: '雇佣',
          domain: 'work',
          category: 'employment',
          sourceEntityTypes: ['OrganizationEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const tempFile1 = createTempFile(file1Data);
      const tempFile2 = createTempFile(file2Data);

      try {
        const loaded = loader.loadFromFiles([tempFile1, tempFile2]);
        expect(loaded).toHaveLength(2);
        expect(loaded.some(t => t.relationTypeId === 'family_parent')).toBe(true);
        expect(loaded.some(t => t.relationTypeId === 'work_employ')).toBe(true);
      } finally {
        cleanupTempFile(tempFile1);
        cleanupTempFile(tempFile2);
      }
    });
  });

  describe('validateFile', () => {
    it('should validate a valid file', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const tempFile = createTempFile(types);

      try {
        const validation = loader.validateFile(tempFile);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
        expect(validation.count).toBe(1);
      } finally {
        cleanupTempFile(tempFile);
      }
    });

    it('should detect invalid relation types in file', () => {
      const types = [
        {
          relationTypeId: 'invalid'
          // Missing required fields
        }
      ];

      const tempFile = createTempFile(types);

      try {
        const validation = loader.validateFile(tempFile);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(tempFile);
      }
    });

    it('should handle non-existent file', () => {
      const validation = loader.validateFile('/non/existent/file.json');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear loaded files cache', () => {
      const types = [
        createRelationTypeDefinition({
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        })
      ];

      const tempFile = createTempFile(types);

      try {
        loader.loadFromFile(tempFile);
        expect(loader.getLoadedFiles().length).toBeGreaterThan(0);

        loader.clearCache();
        expect(loader.getLoadedFiles()).toHaveLength(0);
      } finally {
        cleanupTempFile(tempFile);
      }
    });
  });
});
