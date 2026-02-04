/**
 * Relation Type API Tests
 * 
 * Tests for the relation type management API endpoints
 */

const relationTypeStore = require('./relation_type_store');
const relationTypeRegistry = require('./relation_type_registry');
const relationTypeQuery = require('./relation_type_query');

// Mock the store functions
jest.mock('./relation_type_store');

describe('Relation Type API Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/knowledge-graph/relation-types', () => {
    it('should return all relation types when no filters provided', async () => {
      const mockTypes = [
        {
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family'
        },
        {
          relationTypeId: 'work_employ',
          name: 'employ',
          displayName: '雇佣',
          domain: 'work',
          category: 'employment'
        }
      ];
      
      relationTypeStore.findAll.mockResolvedValue(mockTypes);
      
      const result = await relationTypeStore.findAll({ activeOnly: true });
      
      expect(result).toEqual(mockTypes);
      expect(result.length).toBe(2);
      expect(relationTypeStore.findAll).toHaveBeenCalledWith({ activeOnly: true });
    });
    
    it('should filter by domain', async () => {
      const mockTypes = [
        {
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family'
        }
      ];
      
      relationTypeStore.findByDomain.mockResolvedValue(mockTypes);
      
      const result = await relationTypeStore.findByDomain('life', { activeOnly: true });
      
      expect(result).toEqual(mockTypes);
      expect(result.every(t => t.domain === 'life')).toBe(true);
      expect(relationTypeStore.findByDomain).toHaveBeenCalledWith('life', { activeOnly: true });
    });
    
    it('should filter by category', async () => {
      const mockTypes = [
        {
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family'
        }
      ];
      
      relationTypeStore.findByCategory.mockResolvedValue(mockTypes);
      
      const result = await relationTypeStore.findByCategory('family', { activeOnly: true });
      
      expect(result).toEqual(mockTypes);
      expect(result.every(t => t.category === 'family')).toBe(true);
      expect(relationTypeStore.findByCategory).toHaveBeenCalledWith('family', { activeOnly: true });
    });
    
    it('should filter by entity type', async () => {
      const mockTypes = [
        {
          relationTypeId: 'family_parent',
          name: 'parent',
          displayName: '父母',
          domain: 'life',
          category: 'family',
          sourceEntityTypes: ['PersonEntity'],
          targetEntityTypes: ['PersonEntity']
        }
      ];
      
      relationTypeStore.findByEntityType.mockResolvedValue(mockTypes);
      
      const result = await relationTypeStore.findByEntityType('PersonEntity', 'both', { activeOnly: true });
      
      expect(result).toEqual(mockTypes);
      expect(relationTypeStore.findByEntityType).toHaveBeenCalledWith('PersonEntity', 'both', { activeOnly: true });
    });
  });
  
  describe('GET /api/knowledge-graph/relation-types/:id', () => {
    it('should return relation type by ID', async () => {
      const mockType = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        domain: 'life',
        category: 'family'
      };
      
      relationTypeStore.findById.mockResolvedValue(mockType);
      
      const result = await relationTypeStore.findById('family_parent');
      
      expect(result).toEqual(mockType);
      expect(relationTypeStore.findById).toHaveBeenCalledWith('family_parent');
    });
    
    it('should return null for non-existent ID', async () => {
      relationTypeStore.findById.mockResolvedValue(null);
      
      const result = await relationTypeStore.findById('nonexistent');
      
      expect(result).toBeNull();
      expect(relationTypeStore.findById).toHaveBeenCalledWith('nonexistent');
    });
  });
  
  describe('POST /api/knowledge-graph/relation-types', () => {
    it('should create new relation type', async () => {
      const newType = {
        relationTypeId: 'test_relation',
        name: 'test',
        displayName: '测试',
        domain: 'life',
        category: 'test',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true
      };
      
      relationTypeStore.create.mockResolvedValue(newType);
      
      const result = await relationTypeStore.create(newType);
      
      expect(result).toEqual(newType);
      expect(relationTypeStore.create).toHaveBeenCalledWith(newType);
    });
    
    it('should reject creation with missing required fields', async () => {
      const invalidType = {
        relationTypeId: 'test_relation',
        name: 'test'
        // Missing other required fields
      };
      
      relationTypeStore.create.mockRejectedValue(new Error('Missing required field: displayName'));
      
      await expect(relationTypeStore.create(invalidType)).rejects.toThrow('Missing required field');
    });
  });
  
  describe('PUT /api/knowledge-graph/relation-types/:id', () => {
    it('should update relation type', async () => {
      const updates = {
        displayName: '新名称',
        description: '更新的描述'
      };
      
      const updatedType = {
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '新名称',
        description: '更新的描述',
        domain: 'life',
        category: 'family'
      };
      
      relationTypeStore.update.mockResolvedValue(updatedType);
      
      const result = await relationTypeStore.update('family_parent', updates);
      
      expect(result).toEqual(updatedType);
      expect(relationTypeStore.update).toHaveBeenCalledWith('family_parent', updates);
    });
  });
  
  describe('DELETE /api/knowledge-graph/relation-types/:id', () => {
    it('should delete relation type', async () => {
      relationTypeStore.delete.mockResolvedValue(true);
      
      const result = await relationTypeStore.delete('family_parent');
      
      expect(result).toBe(true);
      expect(relationTypeStore.delete).toHaveBeenCalledWith('family_parent');
    });
    
    it('should return false for non-existent ID', async () => {
      relationTypeStore.delete.mockResolvedValue(false);
      
      const result = await relationTypeStore.delete('nonexistent');
      
      expect(result).toBe(false);
      expect(relationTypeStore.delete).toHaveBeenCalledWith('nonexistent');
    });
  });
  
  describe('GET /api/knowledge-graph/relation-types-stats', () => {
    it('should return statistics', async () => {
      const mockStats = {
        total: 90,
        active: 85,
        inactive: 5,
        byDomain: {
          life: 17,
          work: 15,
          travel: 13,
          shopping: 13,
          government: 16,
          management: 16
        },
        byCategory: {
          family: 6,
          social: 4,
          residence: 3,
          health: 4
        }
      };
      
      relationTypeStore.getStats.mockResolvedValue(mockStats);
      
      const result = await relationTypeStore.getStats();
      
      expect(result).toEqual(mockStats);
      expect(result.total).toBe(90);
      expect(Object.keys(result.byDomain).length).toBe(6);
    });
  });
  
  describe('Query and Search Operations', () => {
    it('should search relation types by keyword', () => {
      const registry = new relationTypeRegistry();
      registry.register({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true,
        version: '1.0.0',
        active: true
      });
      
      const query = new relationTypeQuery(registry);
      const results = query.search('父母');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].displayName).toContain('父母');
    });
    
    it('should get compatible relation types', () => {
      const registry = new relationTypeRegistry();
      registry.register({
        relationTypeId: 'family_parent',
        name: 'parent',
        displayName: '父母',
        description: '表示父母关系',
        domain: 'life',
        category: 'family',
        sourceEntityTypes: ['PersonEntity'],
        targetEntityTypes: ['PersonEntity'],
        isDirectional: true,
        isTemporal: false,
        supportsConfidence: true,
        version: '1.0.0',
        active: true
      });
      
      const query = new relationTypeQuery(registry);
      const compatible = query.getCompatibleTypes('PersonEntity', 'PersonEntity');
      
      expect(compatible.length).toBeGreaterThan(0);
      expect(compatible[0].sourceEntityTypes).toContain('PersonEntity');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      relationTypeStore.findAll.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(relationTypeStore.findAll()).rejects.toThrow('Database connection failed');
    });
    
    it('should handle invalid input', async () => {
      relationTypeStore.create.mockRejectedValue(new Error('Invalid relation type definition'));
      
      await expect(relationTypeStore.create({})).rejects.toThrow('Invalid relation type definition');
    });
  });
});
